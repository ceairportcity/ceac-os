import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import ReportingFilingOverview from "../components/ExecutiveFilingOverview";
import QuarterlyReviewEventControl from "../components/QuarterlyReviewEventControl";
import OperationalArchiveRecords from "../components/OperationalArchiveRecords";
import { dateOnly } from "../lib/time";
import { reportAccraDate, reportDateOnly, reportWeekRange, reportMonthRange } from "../lib/ghanaReportingDates";
import { isIssuedUnitReport, latestUnitReportStatus } from "../lib/ministryReportingFacts";
import { ProductNotice } from "../components/bits";
import { Button, ComposerDrawer, Skeleton, StatePanel } from "../experience-v2/components";
import {
  ReportingEmpty,
  ReportingFootnote,
  ReportingPageHeader,
  ReportingRecordRow,
  ReportingSection,
  ReportingTabs,
  ReportingStatusBadge,
} from "../experience-v2/reporting-family/ReportingFamilyV2";

const KINDS = [["week","Weekly"],["month","Monthly"],["project","Project"],["year","Yearly"]];

export default function Reports({ me }) {
  const [periods, setPeriods] = useState([]);
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(null);
  const [filingFilter,setFilingFilter] = useState("all");
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [periodCount, setPeriodCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  // The same mounted panel can receive a new authenticated actor or org.
  // A successful former-actor read must never become this actor's evidence.
  const actorScope = [me.org_id, me.id].join(":");
  const currentActorScope = useRef(actorScope);
  currentActorScope.current = actorScope;
  const loadSequence = useRef(0);
  const [loadedActor, setLoadedActor] = useState(null);

  const [kind, setKind] = useState("week");
  const [label, setLabel] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  useEffect(() => {
    setOpen(null);
    setSheet(null);
    setBusy(false);
    void load();
    return () => { loadSequence.current += 1; };
  }, [me.org_id, me.id]);

  useEffect(() => { setFilingFilter("all"); }, [open, actorScope]);

  async function load({ quiet = false } = {}) {
    const requestedActor = actorScope;
    const request = ++loadSequence.current;
    const isCurrent = () => request === loadSequence.current
      && currentActorScope.current === requestedActor;
    if (!quiet) {
      setLoading(true);
      setLoadedActor(null);
      setPeriodCount(null);
      setPeriods([]); setReports([]); setUnits([]);
    }
    setLoadFailed(false);
    setMsg(null);
    try {
      const [periodResult, reportResult, unitResult] = await Promise.all([
        // This page deliberately shows only the most recent 40 periods;
        // its label makes that partial history explicit.
        supabase.from("report_periods").select("*",{count:"exact"}).eq("org_id",me.org_id).order("starts_on", { ascending: false }).limit(40),
        supabase.from("reports").select("id, period_id, scope, unit_id, project_id, status, version, narrative, challenges, submitted_at, submitted_by, evidence",{count:"exact"}).eq("org_id",me.org_id).eq("scope","unit"),
        supabase.from("units").select("id, name",{count:"exact"}).eq("org_id",me.org_id).eq("active", true).order("name"),
      ]);
      if (!isCurrent()) return;
      const exact = (response) => !response.error && Array.isArray(response.data)
        && typeof response.count === "number";
      if (![periodResult,reportResult,unitResult].every(exact) ||
          periodResult.data.length > periodResult.count ||
          reportResult.data.length !== reportResult.count ||
          unitResult.data.length !== unitResult.count)
        throw new Error("Administrative reporting evidence could not be verified in full.");
      setPeriods(periodResult.data);
      setPeriodCount(periodResult.count);
      setReports(reportResult.data);
      setUnits(unitResult.data);
      setLoadedActor(requestedActor);
    } catch {
      if (!isCurrent()) return;
      setLoadedActor(requestedActor);
      setLoadFailed(true);
      setPeriodCount(null);
      setPeriods([]); setReports([]); setUnits([]);
      setMsg("Administrative reporting evidence is incomplete or unavailable. Retry before inspecting filing coverage.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  function prefill(nextKind) {
    setKind(nextKind);
    // Reporting periods are Ghana civil dates, not the operator's device TZ.
    const now = new Date();
    if (nextKind === "week") {
      const range = reportWeekRange(now);
      const mon = reportDateOnly(range.start);
      const sun = reportDateOnly(range.end);
      const first = new Date(Date.UTC(mon.getUTCFullYear(),0,1));
      const wk = Math.ceil((Math.floor((mon.getTime()-first.getTime())/86400000)+1)/7);
      setStarts(range.start); setEnds(range.end);
      const labelDay = (date) => date.toLocaleDateString("en-GB", {
        timeZone:"Africa/Accra", day:"numeric", month:"short",
      });
      setLabel("Week " + wk + " — " + labelDay(mon) + " – " + labelDay(sun));
    } else if (nextKind === "month") {
      const range = reportMonthRange(now);
      setStarts(range.start); setEnds(range.end); setLabel(range.label);
    } else if (nextKind === "year") {
      const year = reportAccraDate(now).slice(0,4);
      setStarts(year + "-01-01"); setEnds(year + "-12-31"); setLabel(year);
    } else {
      setStarts(""); setEnds(""); setLabel("");
    }
  }

  async function openPeriod() {
    if (busy || loading || loadFailed || loadedActor !== actorScope) return;
    const writingActor = actorScope;
    setBusy(true);
    setMsg(null);
    try {
      if (!label.trim()) throw new Error("Give the period a name people will recognise.");
      if (!starts || !ends) throw new Error("Set the start and end dates.");
      if (ends < starts) throw new Error("The end date is before the start date.");
      const { error } = await supabase.from("report_periods").insert({
        org_id: me.org_id,
        kind,
        label: label.trim(),
        starts_on: starts,
        ends_on: ends,
        status: "open",
      });
      if (currentActorScope.current !== writingActor) return;
      if (error) throw error;
      setSheet(null);
      setLabel("");
      await load();
    } catch (error) {
      if (currentActorScope.current === writingActor) setMsg(error.message);
    } finally {
      if (currentActorScope.current === writingActor) setBusy(false);
    }
  }

  async function setStatus(period, status) {
    if (busy || loading || loadFailed || loadedActor !== actorScope) return;
    if (status === "closed" && !confirm("Close " + period.label + "? Managers will no longer be able to file or change reports for it.")) return;
    const writingActor = actorScope;
    setBusy(true);
    setMsg(null);
    try {
      // Match this tenant and the status the administrator actually reviewed.
      // No updated row is an uncertain operation, not a successful close.
      const { data, error } = await supabase.from("report_periods").update({ status })
        .eq("id", period.id)
        .eq("org_id", me.org_id).eq("status", period.status)
        .select("id,status").single();
      if (currentActorScope.current !== writingActor) return;
      if (error || data?.id !== period.id || data.status !== status) {
        throw new Error("This reporting period change could not be verified. Reload its current state.");
      }
      await load();
    } catch (error) {
      if (currentActorScope.current === writingActor) {
        setMsg(error.message || "This reporting period change could not be verified.");
      }
    } finally {
      if (currentActorScope.current === writingActor) setBusy(false);
    }
  }

  function latestFor(periodId) {
    const inPeriod = reports.filter((report) => report.period_id === periodId && report.scope === "unit");
    return latestUnitReportStatus(inPeriod);
  }

  const statusLabel = loading
    ? "Loading records"
    : loadFailed
      ? "Records unavailable"
      : periods.length
        ? periodCount > periods.length
          ? `Showing the latest ${periods.length} of ${periodCount} reporting periods`
          : `${periods.length} ${periods.length === 1 ? "period" : "periods"} recorded`
        : "No periods recorded";

  if (loadedActor !== actorScope || loading) {
    return (
      <div className="body ev2-reporting-page ev2-reporting-admin" aria-busy="true">
        <ReportingPageHeader
          eyebrow="Administration reporting"
          title="Reports"
          description="Open reporting periods, track named unit follow-up, and inspect submitted narratives without turning coverage into a performance score."
          statusLabel={statusLabel}
        />
        <div className="ev2rep-loading">
          <Skeleton variant="block" height="7rem" />
          <Skeleton variant="block" height="12rem" />
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="body ev2-reporting-page ev2-reporting-admin">
        <ReportingPageHeader
          eyebrow="Administration reporting"
          title="Reports"
          description="Open reporting periods, track named unit follow-up, and inspect submitted narratives without turning coverage into a performance score."
          statusLabel="Records unavailable"
          statusTone="danger"
        />
        <div className="ev2rep-state">
          <StatePanel
            state="error"
            title="Reporting records could not be loaded"
            description="No coverage figures or report records are being shown because the current reporting data could not be retrieved."
            actionLabel="Try again"
            onAction={load}
            icon="reports"
          />
        </div>
      </div>
    );
  }

  if (open) {
    const period = periods.find((row) => row.id === open);
    if (!period) {
      setOpen(null);
      return null;
    }
    const byUnit = latestFor(open);
    const filed = units.filter((unit) => isIssuedUnitReport(byUnit[unit.id]));
    const drafting = units.filter((unit) => byUnit[unit.id] && byUnit[unit.id].status === "draft");
    const missing = units.filter((unit) => !byUnit[unit.id]);
    const challengesRecorded = filed.filter((unit) => byUnit[unit.id]?.challenges).length;
    const visibleDrafts = filingFilter === "waiting" ? [] : drafting;
    const visibleMissing = filingFilter === "draft" ? [] : missing;

    return (
      <div className="body ev2-reporting-page ev2-reporting-admin">
        <ReportingPageHeader
          eyebrow={`${(KINDS.find((row) => row[0] === period.kind) || ["",""])[1]} reporting period`}
          title={period.label}
          description={`${dateOnly(period.starts_on)} — ${dateOnly(period.ends_on)}. Coverage remains factual follow-up context; named units remain visible.`}
          statusLabel={period.status === "open" ? "Period open" : "Period closed"}
          statusTone={period.status === "open" ? "success" : "neutral"}
        />

        <div className="ev2rep-actions">
          <Button variant="secondary" onClick={() => setOpen(null)}>All periods</Button>
          {period.status === "open"
            ? <Button variant="secondary" onClick={() => setStatus(period, "closed")} disabled={busy}>Close period</Button>
            : <Button variant="secondary" onClick={() => setStatus(period, "open")} disabled={busy}>Reopen period</Button>}
        </div>

        {msg ? <ProductNotice tone="error" title="Reporting update">{msg}</ProductNotice> : null}

        <ReportingFilingOverview key={actorScope + ":" + period.id} period={period}
          rows={units.map(unit => ({unit,state:isIssuedUnitReport(byUnit[unit.id]) ? "submitted" : byUnit[unit.id]?.status === "draft" ? "draft" : "waiting"}))}
          onFilter={setFilingFilter} />
        <ReportingTabs label="Department report views" value={filingFilter} onChange={setFilingFilter}
          items={[["all","All departments"],["submitted",`Submitted (${filed.length})`],["draft",`Drafts (${drafting.length})`],["waiting",`Not started (${missing.length})`]]} />

        {(filingFilter === "all" || filingFilter === "submitted") && <ReportingSection
          eyebrow="Submitted reports"
          title="What units reported"
          description="Submitted narratives and recorded challenges from the latest filed version for each unit."
          meta={`${filed.length} reports · ${challengesRecorded} with challenges`}
        >
          {filed.length === 0 ? (
            <ReportingEmpty
              title="Nobody has filed yet"
              description="Submitted unit reports will appear here with their narrative and recorded challenges."
            />
          ) : (
            <div className="ev2rep-list">
              {filed.map((unit) => {
                const report = byUnit[unit.id];
                return (
                  <ReportingRecordRow
                    key={unit.id}
                    eyebrow={report.version > 1 ? `Version ${report.version}` : "Filed"}
                    title={unit.name}
                    meta={report.submitted_at ? `Submitted ${dateOnly(report.submitted_at)}` : "Submitted"}
                    note={report.narrative || "No narrative was recorded."}
                    statusLabel="Filed"
                    statusTone="success"
                  >
                    {report.challenges ? <span className="ev2rep-inline-note">Challenge recorded</span> : null}
                  </ReportingRecordRow>
                );
              })}
            </div>
          )}
        </ReportingSection>}

        {filingFilter !== "submitted" && <ReportingSection
          eyebrow="Follow-up"
          title="Still outstanding"
          description="Units stay named so Administration can follow up directly instead of relying on a bare completion percentage."
          meta={String(visibleDrafts.length + visibleMissing.length)}
        >
          {visibleDrafts.length === 0 && visibleMissing.length === 0 ? (
            <ReportingEmpty title={filingFilter === "all" ? "Every unit has filed" : "No departments in this view"} description={filingFilter === "all" ? "There is no reporting follow-up required for this period." : "Choose another filing status to inspect its departments."} />
          ) : (
            <div className="ev2rep-list">
              {visibleDrafts.map((unit) => (
                <ReportingRecordRow
                  key={`draft-${unit.id}`}
                  eyebrow="Draft"
                  title={unit.name}
                  meta="Draft saved, not submitted"
                  statusLabel="Started"
                  statusTone="warning"
                />
              ))}
              {visibleMissing.map((unit) => (
                <ReportingRecordRow
                  key={`missing-${unit.id}`}
                  eyebrow="No report"
                  title={unit.name}
                  meta="No report recorded for this period"
                  statusLabel="Nothing yet"
                />
              ))}
            </div>
          )}
        </ReportingSection>}

        <ReportingFootnote>
          Reporting coverage is operational filing context. CEAC OS does not infer unit performance, staff performance, achievement or an overall score from submission status.
        </ReportingFootnote>
      </div>
    );
  }

  const openPeriods = periods.filter((period) => period.status === "open");

  return (
    <div className="body ev2-reporting-page ev2-reporting-admin">
      <ReportingPageHeader
        eyebrow="Administration reporting"
        title="Reports"
        description="Open reporting periods, see named filing follow-up, and inspect unit narratives. Administration owns reporting periods; Managers file within their authorised scope."
        statusLabel={statusLabel}
      />

      <QuarterlyReviewEventControl me={me} />

      {me.is_admin && <div className="ev2rep-actions"><Button variant="secondary" onClick={() => setArchiveOpen((value) => !value)}>
        {archiveOpen ? "Hide work & reporting archives" : "Review demo work & reporting archives"}
      </Button></div>}
      {me.is_admin && archiveOpen && <OperationalArchiveRecords key={actorScope} onChanged={() => load({ quiet: true })} />}

      {msg && !sheet ? <ProductNotice tone="error" title="Reporting update">{msg}</ProductNotice> : null}

      <div className="ev2rep-actions">
        <Button onClick={() => { prefill("week"); setSheet("new"); setMsg(null); }}>Open reporting period</Button>
      </div>

      {openPeriods.length === 0 ? (
        <div className="ev2rep-live-state">
          <strong>No period is open</strong>
          Managers cannot file or save a report against a missing reporting period. Open a week, month, project or year period when reporting should begin.
        </div>
      ) : null}

      <ReportingSection
        eyebrow="Period operations"
        title="Reporting periods"
        description="Open or close the periods Managers file against. Closing a period prevents further filing or changes for that period."
        meta={String(periods.length)}
      >
        {periods.length === 0 ? (
          <ReportingEmpty
            title="No reporting periods recorded"
            description="Open a reporting period to establish the filing window Managers will use."
          />
        ) : (
          <div className="ev2rep-list">
            {periods.map((period) => {
              const byUnit = latestFor(period.id);
              const filed = units.filter((unit) => isIssuedUnitReport(byUnit[unit.id])).length;
              const drafting = units.filter((unit) => byUnit[unit.id] && byUnit[unit.id].status === "draft").length;
              const missing = units.filter((unit) => !byUnit[unit.id]).length;
              return (
                <ReportingRecordRow
                  key={period.id}
                  eyebrow={(KINDS.find((row) => row[0] === period.kind) || ["",""])[1]}
                  title={period.label}
                  meta={`${dateOnly(period.starts_on)} — ${dateOnly(period.ends_on)} · ${filed} submitted · ${drafting} draft · ${missing} nothing yet`}
                  statusLabel={period.status === "open" ? "Open" : "Closed"}
                  statusTone={period.status === "open" ? "success" : "neutral"}
                >
                  <Button variant="secondary" size="sm" onClick={() => setOpen(period.id)}>Open report</Button>
                </ReportingRecordRow>
              );
            })}
          </div>
        )}
      </ReportingSection>

      <ReportingFootnote>
        Reporting completeness is not a performance score. Submitted, draft and missing states describe filing status only, and outstanding units remain named for follow-up.
      </ReportingFootnote>

      {sheet === "new" ? (
        <ComposerDrawer open title="Open a reporting period" onClose={() => { if (!busy) setSheet(null); }}
          description="Managers file against this period. The name and dates become part of the reporting record.">

          <div className="ev2rep-kind-picker" role="group" aria-label="Reporting period kind">
            {KINDS.map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={kind === key ? "is-active" : ""}
                aria-pressed={kind === key}
                onClick={() => prefill(key)}
              >
                {text}
              </button>
            ))}
          </div>

          <label className="ev2rep-field-label">
            Period name
            <input className="field" placeholder="What to call it" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <div className="ev2rep-control-grid">
            <label className="ev2rep-field-label">
              Start date
              <input className="field" type="date" value={starts} onChange={(event) => setStarts(event.target.value)} />
            </label>
            <label className="ev2rep-field-label">
              End date
              <input className="field" type="date" value={ends} onChange={(event) => setEnds(event.target.value)} />
            </label>
          </div>

          {msg ? <ProductNotice tone="error" title="Reporting period">{msg}</ProductNotice> : null}
          <Button onClick={openPeriod} disabled={busy}>{busy ? "Opening…" : "Open period"}</Button>
        </ComposerDrawer>
      ) : null}
    </div>
  );
}
