import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";
import { ProductNotice, LoadingState, StatusDistribution, Avatar, ProgressMeter } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Stat, Table } from "../components/primitives";

// Attendance & leave, organisation-wide. Spec section 7.
//
// The rule that governs this whole screen: flags are shown as flags, never
// as findings. The screen says what was recorded, not what it means. There
// is no language here implying dishonesty, and no flag is ever phrased as
// an accusation — a person can be outside the office radius for a dozen
// ordinary reasons.
const TABS = [["today","Today"],["sessions","Session history"],["flagged","Recorded differences"],["leave","Leave"]];

// Straight-line distance between two points, in metres.
function metresBetween(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

export default function Attendance({ me }) {
  const [tab, setTab] = useState("today");
  const [people, setPeople] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leave, setLeave] = useState([]);
  const [office, setOffice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [ps, mem, ss, lv, off, st] = await Promise.all([
      supabase.from("profiles").select("id, full_name, active").eq("active", true).order("full_name"),
      supabase.from("unit_memberships").select("profile_id, unit_id, units(name)"),
      supabase.from("work_sessions").select("id, profile_id, place, started_at, ended_at, end_reason, lat, lng, ip, flags").gte("started_at", since).order("started_at", { ascending: false }),
      supabase.from("leave_requests").select("id, profile_id, kind, start_date, end_date, days, status, profiles(full_name)").order("start_date", { ascending: false }),
      supabase.from("office_locations").select("name, lat, lng, radius_meters").eq("is_primary", true).limit(1).maybeSingle(),
      supabase.from("leave_settings").select("annual_days, sick_days, max_carryover, updated_by").eq("org_id", me.org_id).maybeSingle(),
    ]);
    const unitOf = {};
    (mem.data || []).forEach((m) => { unitOf[m.profile_id] = m.units ? m.units.name : null; });
    setPeople((ps.data || []).map((p) => ({ ...p, unit_name: unitOf[p.id] || null })));
    setSessions((ss.data || []).map((s) => ({ ...s, unit_name: unitOf[s.profile_id] || null })));
    setLeave(lv.data || []);
    setOffice(off.data || null);
    setSettings(st.data || null);
    setLoading(false);
  }

  if (loading) return <div className="body"><LoadingState label="Loading attendance & leave…" /></div>;

  const today = new Date().toDateString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const nameOf = (id) => { const p = people.find((x) => x.id === id); return p ? p.full_name : "—"; };
  const todaySessions = sessions.filter((s) => new Date(s.started_at).toDateString() === today);
  const workingNow = todaySessions.filter((s) => !s.ended_at);
  const onLeaveToday = leave.filter((l) => l.status === "approved" && l.start_date <= todayStr && l.end_date >= todayStr);
  const startedToday = new Set(todaySessions.map((s) => s.profile_id));
  const awayIds = new Set(onLeaveToday.map((l) => l.profile_id));
  const notStarted = people.filter((p) => !startedToday.has(p.id) && !awayIds.has(p.id));

  // Average start time per unit, from the last 30 days.
  const byUnit = {};
  sessions.forEach((s) => {
    const u = s.unit_name || "No unit";
    if (!byUnit[u]) byUnit[u] = [];
    const d = new Date(s.started_at);
    byUnit[u].push(d.getHours() * 60 + d.getMinutes());
  });
  const unitStarts = Object.entries(byUnit).map(([u, mins]) => {
    const a = Math.round(mins.reduce((x, y) => x + y, 0) / mins.length);
    return { unit: u, avg: String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0"), n: mins.length };
  }).sort((a, b) => a.avg.localeCompare(b.avg));

  // What was recorded differently from the ordinary pattern. Descriptive only.
  function differences(s) {
    const out = [];
    if (s.end_reason && s.end_reason !== "manual") out.push("ended by the system, not by them");
    if (!s.ended_at && new Date(s.started_at).toDateString() !== today) out.push("never ended");
    if (s.place === "office" && office && s.lat && s.lng) {
      const d = metresBetween(Number(office.lat), Number(office.lng), s.lat, s.lng);
      if (d > (office.radius_meters || 100)) out.push("marked as the office, recorded " + d + "m from the office point");
    }
    if (s.place === "office" && !s.lat) out.push("marked as the office, no location recorded");
    if (s.flags && typeof s.flags === "object") {
      Object.keys(s.flags).forEach((k) => { if (s.flags[k]) out.push(String(k).replace(/_/g, " ")); });
    }
    return out;
  }
  const flagged = sessions.map((s) => ({ s, d: differences(s) })).filter((x) => x.d.length);

  const leavePolicyConfigured = Boolean(settings?.updated_by);
  const configuredAnnualDays = leavePolicyConfigured ? Number(settings.annual_days || 0) : null;
  const liability = configuredAnnualDays === null ? null : people.length * configuredAnnualDays;

  return (
    <div className="body">
      <div style={{ paddingTop: 26 }}>
        <div className="eyebrow">Factual administration</div>
    <h1 className="h1">Attendance &amp; leave</h1>
        <p className="screen-note">Across the whole church. Hours are a record of activity, not a basis for pay. Attendance is context, not a performance judgement.</p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontSize: 12.5, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--line)",
            background: tab === k ? "var(--ink)" : "var(--card)",
            color: tab === k ? "#fff" : "var(--ink-soft)", fontWeight: tab === k ? 600 : 400,
          }}>{label}</button>))}
      </div>

      {!leavePolicyConfigured && (
        <ProductNotice tone="attention" title="Leave policy not configured">Entitlement, carry-over and leave-balance totals stay unavailable until Administration confirms CEAC's leave policy in Settings.</ProductNotice>)}

      {!office && (
        <div className="flag flag-amber">
          <h4>The office point has not been set</h4>
          Until it is, the app cannot tell the office from anywhere else, so nothing below distinguishes them. Set it in Settings.
        </div>)}

      {tab === "today" && (<>
        <section className="attendance-today-overview">
          <div className="attendance-today-copy">
            <span>Today</span>
            <strong>{people.length} people on record</strong>
            <small>Recorded work-session and approved-leave context only.</small>
          </div>
          <StatusDistribution label="Attendance context today" segments={[
            { key:"started", label:"Session started", value:startedToday.size, tone:"success" },
            { key:"leave", label:"Approved leave", value:onLeaveToday.length, tone:"info" },
            { key:"none", label:"No session recorded", value:notStarted.length, tone:"neutral" },
          ]} />
          <div className="attendance-fact-strip">
            <Stat icon="people" label="Working now" value={workingNow.length} onOpen={() => setTab("today")} />
            <Stat icon="clock" label="Sessions started" value={todaySessions.length} onOpen={() => setTab("sessions")} />
            <Stat icon="calendar" label="Approved leave" value={onLeaveToday.length} onOpen={() => setTab("leave")} />
            <Stat icon="warning" label="No session recorded" value={notStarted.length}
                  tone={notStarted.length ? "slow" : "ink"} onOpen={() => setTab("today")} />
          </div>
        </section>

        <div className="sec"><span>Working now</span><span>{workingNow.length}</span></div>
        {workingNow.length === 0 && <div className="card small">Nobody has an open session.</div>}
        {workingNow.map((s) => (
          <div key={s.id} className="attendance-person-row">
            <Avatar name={nameOf(s.profile_id)} size="sm" />
            <div><strong>{nameOf(s.profile_id)}</strong><span>{s.unit_name || "No unit"} · since {new Date(s.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <small>{s.place === "office" ? "Office" : "Elsewhere"}</small>
          </div>))}

        <div className="sec"><span>Away today</span><span>{onLeaveToday.length}</span></div>
        {onLeaveToday.length === 0 && <div className="card small">Nobody is on approved leave today.</div>}
        {onLeaveToday.map((l) => (
          <div key={l.id} className="attendance-person-row">
            <Avatar name={l.profiles ? l.profiles.full_name : nameOf(l.profile_id)} size="sm" />
            <div><strong>{l.profiles ? l.profiles.full_name : nameOf(l.profile_id)}</strong><span>{l.kind} leave</span></div>
            <small>Back {dateOnly(l.end_date)}</small>
          </div>))}

        <div className="sec"><span>No session started today</span><span>{notStarted.length}</span></div>
        {notStarted.length === 0 && <div className="card small">Everyone has started or is on leave.</div>}
        {notStarted.map((p) => (
          <div key={p.id} className="attendance-person-row quiet">
            <Avatar name={p.full_name} size="sm" />
            <div><strong>{p.full_name}</strong><span>{p.unit_name || "No unit"}</span></div>
            <small>No session recorded · not an absence judgement</small>
          </div>))}

      </>)}

      {tab === "sessions" && (<>
        <div className="sec"><span>Last 30 days</span><span>{sessions.length}</span></div>
        <div className="attendance-unit-context">
          <strong>Recorded start context by unit</strong>
          <span>Descriptive only. Units work different service, setup and shift patterns, so these are not comparable performance measures.</span>
          <div className="attendance-unit-context-grid">
            {unitStarts.map((u) => <div key={u.unit}><b>{u.avg}</b><span>{u.unit}</span><small>{u.n} session{u.n === 1 ? "" : "s"}</small></div>)}
          </div>
        </div>
        <Table
          rows={sessions.slice(0,120)}
          empty="No work sessions were recorded in this period."
          exportName="ceac-attendance-sessions"
          columns={[
            { key:"profile_id",label:"Person",render:(row)=>nameOf(row.profile_id) },
            { key:"started_at",label:"Date",width:115,render:(row)=>new Date(row.started_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) },
            { key:"started_at_time",label:"Start",width:90,render:(row)=>new Date(row.started_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),sortValue:(row)=>new Date(row.started_at).getTime() },
            { key:"ended_at",label:"End",width:90,render:(row)=>row.ended_at?new Date(row.ended_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"Open" },
            { key:"place",label:"Place",render:(row)=>row.place==="office"?"Office":"Elsewhere" },
            { key:"unit_name",label:"Unit",render:(row)=>row.unit_name || "—" },
          ]}
        />
        {sessions.length > 120 && <div className="card small">Showing the most recent 120. Export reflects the visible rows.</div>}
      </>)}

      {tab === "flagged" && (<>
        <div className="sec"><span>Recorded differences</span><span>{flagged.length}</span></div>
        <div className="flag flag-green">
          <h4>What this list is</h4>
          Sessions where what was recorded differs from the ordinary pattern. These are records, not conclusions.
          There are many innocent reasons for every line here — a phone with poor signal, an errand, a service
          off-site, a flat battery. Ask the person before drawing any conclusion.
        </div>
        {flagged.length === 0 && <div className="card small">Nothing recorded differently in the last 30 days.</div>}
        {flagged.map(({ s, d }) => (
          <div key={s.id} className="row">
            <div className="row-t">{nameOf(s.profile_id)}</div>
            <div className="row-m">
              {new Date(s.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·
              {" "}{new Date(s.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {s.unit_name || "no unit"}
            </div>
            {d.map((x, i) => <div key={i} className="row-note">{x}</div>)}
          </div>))}
      </>)}

      {tab === "leave" && (<>
        <div className="sec"><span>Waiting on a decision</span></div>
        {leave.filter((l) => l.status === "pending" || l.status === "escalated").length === 0 &&
          <div className="card small">No leave requests are waiting.</div>}
        {leave.filter((l) => l.status === "pending" || l.status === "escalated").map((l) => (
          <div key={l.id} className="row">
            <div className="row-t">{l.profiles ? l.profiles.full_name : nameOf(l.profile_id)} — {l.days} day{l.days === 1 ? "" : "s"} {l.kind}</div>
            <div className="row-m">{dateOnly(l.start_date)} — {dateOnly(l.end_date)} · {l.status === "escalated" ? "sent up from a manager" : "with their manager"}</div>
          </div>))}
        <p className="small" style={{ marginTop: 6 }}>Approve or decline these on your Home screen.</p>

        <div className="sec"><span>Who is away, and when</span></div>
        {leave.filter((l) => l.status === "approved" && l.end_date >= todayStr).length === 0 &&
          <div className="card small">Nobody has approved leave coming up.</div>}
        {leave.filter((l) => l.status === "approved" && l.end_date >= todayStr)
          .sort((a, b) => a.start_date.localeCompare(b.start_date)).map((l) => (
          <div key={l.id} className="row">
            <div className="row-t">{l.profiles ? l.profiles.full_name : nameOf(l.profile_id)}</div>
            <div className="row-m">{dateOnly(l.start_date)} — {dateOnly(l.end_date)} · {l.days} day{l.days === 1 ? "" : "s"} {l.kind}</div>
          </div>))}

        <div className="sec"><span>Across the office</span></div>
      {!leavePolicyConfigured && <div className="card small">Entitlement and carry-over totals are unavailable until Administration confirms the leave policy in Settings.</div>}
        <div className="card attendance-leave-overview">
          {liability === null
            ? <div className="attendance-leave-unconfigured"><strong>Annual entitlement</strong><span>Not configured</span></div>
            : <ProgressMeter
                value={leave.filter((l) => l.status === "approved" && l.end_date >= todayStr).reduce((s, l) => s + (l.days || 0), 0)}
                max={liability}
                label="Approved leave still to come"
                detail={leave.filter((l) => l.status === "approved" && l.end_date >= todayStr).reduce((s, l) => s + (l.days || 0), 0) + " of " + liability + " organisation days"}
              />}
        </div>
        <p className="small" style={{ marginTop: 6 }}>{leavePolicyConfigured ? `Configured annual entitlement: ${settings.annual_days} days per person.` : "No CEAC entitlement is assumed until the policy is confirmed in Settings."}</p>
      </>)}
    </div>);
}
