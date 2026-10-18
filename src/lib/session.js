import { supabase } from "./supabase";
import { getPositionOnce } from "./locationEvidence";
export async function openSession(orgId, userId) {
  const { data, error } = await supabase.from("work_sessions")
    .select("id, started_at, last_confirmed_at, place, work_item_id")
    // The current employee can have historical records across CEAC units,
    // but this lookup must never bridge organisation boundaries.
    .eq("org_id", orgId).eq("profile_id", userId).is("ended_at", null)
    // Fetch two rows so duplicate simultaneous sessions are rejected rather
    // than silently selecting one. maybeSingle reports multiple rows as an
    // error, and callers then withhold all Start/End controls until verified.
    .order("started_at", { ascending: false }).limit(2).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function startWork(orgId, userId, place, workItemId, officeLocationId = null) {
  const pos = await getPositionOnce();
  if (place === "office" && pos.failure) {
    throw new Error(`${pos.failure}. Allow location access and retry to verify an office start. No session was started.`);
  }
  let verifiedOfficeLocationId = null;
  if (place === "office") {
    // A declared office/programme location must be a recorded CEAC location
    // in the active organisation. Other callers retain the primary-office
    // fallback until they adopt the explicit location picker.
    let locationQuery = supabase.from("office_locations")
      .select("id").eq("org_id", orgId);
    locationQuery = officeLocationId
      ? locationQuery.eq("id", officeLocationId)
      : locationQuery.eq("is_primary", true);
    const { data: location, error: locationError } =
      await locationQuery.limit(1).maybeSingle();
    if (locationError) throw locationError;
    if (!location) {
      throw new Error("Choose a CEAC-authorised office or programme location before starting work.");
    }
    verifiedOfficeLocationId = location.id;
  }
  const { data, error } = await supabase.from("work_sessions").insert({
    org_id: orgId, profile_id: userId, place, work_item_id: workItemId,
    office_location_id: verifiedOfficeLocationId,
    lat: pos.lat ?? null, lng: pos.lng ?? null,
    location_accuracy_m: pos.accuracy ?? null, location_captured_at: pos.capturedAt ?? null,
    device_time: new Date().toISOString(),
  }).select("id, started_at, last_confirmed_at, place, work_item_id").single();
  if (error) throw error;
  return data;
}
export async function endWork(sessionId) {
  const pos = await getPositionOnce();
  const { data, error } = await supabase.rpc("end_work_session_with_location", {
    p_session_id: sessionId, p_lat: pos.lat ?? null, p_lng: pos.lng ?? null,
    p_accuracy_m: pos.accuracy ?? null, p_captured_at: pos.capturedAt ?? null,
    p_device_time: new Date().toISOString(), p_failure: pos.failure ?? null,
  });
  if (error) throw error;
  return data;
}
export async function reconcileWorkSession(sessionId, action, effectiveEndedAt = null, note = null) {
  if (action === "continue") {
    const pos = await getPositionOnce();
    const { data, error } = await supabase.rpc("continue_work_session_with_location", {
      p_session_id: sessionId, p_lat: pos.lat ?? null, p_lng: pos.lng ?? null,
      p_accuracy_m: pos.accuracy ?? null, p_captured_at: pos.capturedAt ?? null,
    });
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.rpc("reconcile_work_session", {
    p_session_id: sessionId,
    p_action: action,
    p_effective_ended_at: effectiveEndedAt,
    p_note: note,
  });
  if (error) throw error;
  return data;
}
