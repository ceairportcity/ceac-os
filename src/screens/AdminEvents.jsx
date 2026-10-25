import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";

function eventTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanize(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminEvents({ me }) {
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState({});
  const [eventType, setEventType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error: eventError } = await supabase
      .from("platform_events")
      .select("id,event_type,actor_id,subject_profile_id,aggregate_type,aggregate_id,payload,payload_version,correlation_id,causation_event_id,occurred_at,recorded_at")
      .eq("org_id", me.org_id)
      .order("recorded_at", { ascending: false })
      .limit(250);

    if (eventError) {
      setError(humanError(eventError, "System events could not load."));
      setLoading(false);
      return;
    }

    const rows = data || [];
    const profileIds = [...new Set(rows.flatMap((event) => [event.actor_id, event.subject_profile_id]).filter(Boolean))];
    let profileMap = {};
    if (profileIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", profileIds);
      if (profileError) {
        setError(humanError(profileError, "Event people could not be resolved."));
        setLoading(false);
        return;
      }
      profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.full_name]));
    }

    setEvents(rows);
    setPeople(profileMap);
    setLoading(false);
  }

  const types = useMemo(
    () => [...new Set(events.map((event) => event.event_type).filter(Boolean))].sort(),
    [events]
  );

  const search = searchText.trim().toLowerCase();
  const shown = events.filter((event) => {
    if (eventType !== "all" && event.event_type !== eventType) return false;
    if (!search) return true;
    return [
      event.event_type,
      event.aggregate_type,
      event.aggregate_id,
      event.correlation_id,
      people[event.actor_id],
      people[event.subject_profile_id],
      ...Object.values(event.payload || {}),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
  });

  if (loading) return <div className="body"><LoadingState label="Loading system events…" /></div>;

  return <div className="body">
    <div style={{ paddingTop: 26 }}>
      <div className="eyebrow">Control Center</div>
      <h1 className="h1">System events</h1>
      <p className="screen-note">Durable internal business events used by workflows, integrations, notifications and later intelligence.</p>
    </div>

    {error && <ProductNotice tone="error" title="System events">{error}</ProductNotice>}

    <div className="split" style={{ marginTop: 18 }}>
      <div className="main-col">
        <div className="sec"><span>Event stream</span><span>{shown.length}</span></div>
        {shown.map((event) => <div className="row" key={event.id}>
          <div className="row-t">{humanize(event.event_type)}</div>
          <div className="row-m">
            {eventTime(event.occurred_at)}
            {" · " + (people[event.actor_id] || "System")}
          </div>
          <div className="row-m" style={{ marginTop: 5 }}>
            {humanize(event.aggregate_type)}
            {event.aggregate_id ? " · " + event.aggregate_id.slice(0, 8) : ""}
            {" · v" + event.payload_version}
          </div>
          {event.subject_profile_id && <div className="small" style={{ marginTop: 6 }}>
            Subject: {people[event.subject_profile_id] || event.subject_profile_id.slice(0, 8)}
          </div>}
          {Object.keys(event.payload || {}).length > 0 && <div className="small" style={{ marginTop: 6 }}>
            {Object.entries(event.payload).map(([key, value]) => humanize(key) + ": " + String(value ?? "—")).join(" · ")}
          </div>}
          <div className="small" style={{ marginTop: 6 }}>Correlation: {event.correlation_id.slice(0, 8)}</div>
        </div>)}
        {shown.length === 0 && <EmptyState title="No system events match">Change the event filter or search.</EmptyState>}
      </div>

      <div className="side-col">
        <div className="sec"><span>Filter</span></div>
        <div className="card" style={{ padding: 15 }}>
          <FieldGroup label="Search">
            <input className="field" aria-label="Search system events" type="search" placeholder="Event, person, aggregate or correlation" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          </FieldGroup>
          <FieldGroup label="Event type">
            <select className="field" aria-label="System event type" value={eventType} onChange={(event) => setEventType(event.target.value)}>
              <option value="all">All event types</option>
              {types.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </FieldGroup>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={load}>Refresh events</button>
        </div>

        <div className="sec"><span>Contract</span></div>
        <div className="card" style={{ padding: 15 }}>
          <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>
            System events are append-only and are not authored directly by users. Their payloads stay deliberately small and exclude protected HR, payroll values, credentials and arbitrary row snapshots.
          </p>
        </div>
      </div>
    </div>
  </div>;
}
