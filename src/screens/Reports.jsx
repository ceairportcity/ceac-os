import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import QuarterlyReviewEventControl from "../components/QuarterlyReviewEventControl";
import { dateOnly } from "../lib/time";
import { isIssuedUnitReport, latestUnitReportStatus } from "../lib/ministryReportingFacts";
import { Sheet, ProductNotice } from "../components/bits";
import { Button, Skeleton, StatePanel } from "../experience-v2/components";
import {
  ReportingEvidenceCard,
  ReportingEvidenceGrid,
  ReportingEmpty,
  ReportingFootnote,
  ReportingPageHeader,
  ReportingRecordRow,
  ReportingSection,
  ReportingStatusBadge,
} from "../experience-v2/reporting-family/ReportingFamilyV2";

const KINDS = [["week","Weekly"],["month","Monthly"],["project","Project"],["year","Yearly"]];

export default function Reports({ me }) {
  const [periods, setPeriods] = useState([]);
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const [kind, setKind] = useState("week");
  const [label, setLabel] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    setMsg(null);
    const [periodResult, reportResult, unitResult] = await Promise.all([
      supabase.from("report_periods").select("*").eq("org_id",me.org_id).order("starts_on", { ascending: false }).limit(40),
      supabase.from("reports").select("id, period_id, scope, unit_id, project_id, status, version, narrative, challenges, submitted_at, submitted_by, evidence").eq("org_id",me.org_id).eq("scope","unit"),
      supabase.from("units").select("id, name").eq("org_id",me.org_id).eq("active", true).order("name"),
    ]);
    const loadError = periodResult.error || reportResult.error || unitResult.error;
    if (loadError) {
      setLoadFailed(true);
      setMsg(loadError.message);
      setLoading(false);
      return;
    }
    setPeriods(periodResult.data || []);
    setReports(reportResult.data || []);
    setUnits(unitResult.data || []);
    setLoading(false);
  }

  function prefill(nextKind) {
    setKind(nextKind);
    const now = new Date();
    if (nextKind === "week") {
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7;
      const mon = new Date(d); mon.setDate(d.getDate() - day);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const wk = Math.ceil((((mon - new Date(mon.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
      setStarts(mon.toISOString().slice(0, 10));
      setEnds(sun.toISOString().slice(0, 10));
      setLabel("Week " + wk + " — " + mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        + " – " + sun.toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
    } else if (nextKind === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStarts(first.toISOString().slice(0, 10));
      setEnds(last.toISOString().slice(0, 10));
      setLabel(first.toLocaleDateString("en-GB", { month: "long", year: "numeric" }));
    } else if (nextKind === "year") {
      setStarts(now.getFullYear() + "-01-01");
      setEnds(now.getFullYear() + "-12-31");
      setLabel(String(now.getFullYear()));
    } else {
      setStarts("");
      setEnds("");
      setLabel("");
    }
  }

  async function openPeriod() {
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
      if (error) throw error;
      setSheet(null);
      setLabel("");
      await load();
    } catch (error) {
      setMsg(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(period, status) {
    if (status === "closed" && !confirm("Close " + period.label + "? Managers will no longer be able to file or change reports for it.")) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("report_periods").update({ status }).eq("id", period.id);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
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
        ? `${periods.length} ${periods.length === 1 ? "period" : "periods"} recorded`
        : "No periods recorded";

  if (loading) {
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

        <ReportingSection
          eyebrow="Coverage"
          title="Reporting status by unit"
          description="Submitted, draft and missing are filing states only. They are not performance ratings."
        >
          <ReportingEvidenceGrid>
            <ReportingEvidenceCard value={String(filed.length)} label="submitted units" detail={`${filed.length} of ${units.length} units`} tone="success" />
            <ReportingEvidenceCard value={String(drafting.length)} label="drafts" detail="Started, not submitted" tone="warning" />
            <ReportingEvidenceCard value={String(missing.length)} label="nothing yet" detail="Named follow-up below" />
            <ReportingEvidenceCard value={String(challengesRecorded)} label="submitted challenges" detail="Recorded narrative context" />
          </ReportingEvidenceGrid>
        </ReportingSection>

        <ReportingSection
          eyebrow="Submitted reports"
          title="What units reported"
          description="Submitted narratives and recorded challenges from the latest filed version for each unit."
          meta={String(filed.length)}
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
        </ReportingSection>

        <ReportingSection
          eyebrow="Follow-up"
          title="Still outstanding"
          description="Units stay named so Administration can follow up directly instead of relying on a bare completion percentage."
          meta={String(drafting.length + missing.length)}
        >
          {drafting.length === 0 && missing.length === 0 ? (
            <ReportingEmpty title="Every unit has filed" description="There is no reporting follow-up required for this period." />
          ) : (
            <div className="ev2rep-list">
              {drafting.map((unit) => (
                <ReportingRecordRow
                  key={`draft-${unit.id}`}
                  eyebrow="Draft"
                  title={unit.name}
                  meta="Draft saved, not submitted"
                  statusLabel="Started"
                  statusTone="warning"
                />
              ))}
              {missing.map((unit) => (
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
        </ReportingSection>

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
        <Sheet onClose={() => setSheet(null)}>
          <div className="h2">Open a reporting period</div>
          <p className="screen-note">Managers file against this period. The name and dates become part of the reporting record.</p>

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
        </Sheet>
      ) : null}
    </div>
  );
}
