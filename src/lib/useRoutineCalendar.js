import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { readRoutineCalendar } from "./readRoutineCalendar.js";

const EMPTY = Object.freeze([]);
export default function useRoutineCalendar(me, { scope, fromDate, throughDate, enabled = true }) {
  const key = [me.org_id, me.id, me.unit_id || "", scope, fromDate, throughDate, enabled].join(":");
  const [snapshot, setSnapshot] = useState({ key: "", events: EMPTY, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setSnapshot({ key, events: EMPTY, error: "", loading: true });
    readRoutineCalendar(supabase, { id: me.id, org_id: me.org_id, unit_id: me.unit_id }, { scope, fromDate, throughDate })
      .then(events => {
        if (current) setSnapshot({ key, events, error: "", loading: false });
      })
      .catch(() => {
        if (current) setSnapshot({ key, events: EMPTY,
          error: "Routine dates could not be verified for this period. Retry or choose a date within the next year.", loading: false });
      });
    return () => { current = false; };
  }, [key, revision, enabled, me.id, me.org_id, me.unit_id, scope, fromDate, throughDate]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const current = enabled && snapshot.key === key;
  return {
    events: current ? snapshot.events : EMPTY,
    error: current ? snapshot.error : "",
    loading: enabled && (!current || snapshot.loading),
    reload: () => setRevision(value => value + 1),
  };
}
