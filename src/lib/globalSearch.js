import { supabase } from "./supabase";

const LIMIT = 6;

function cleanQuery(value) {
  return String(value || "").trim().replace(/[%_]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function contains(value, query) {
  return String(value || "").toLowerCase().includes(query.toLowerCase());
}

function safeData(result) {
  return result?.error ? [] : (result?.data || []);
}

// Surface authorised Work lookup failures without exposing private SQL details,
 // table text, or database exception messages in the browser.
function safeWorkSearchFailure(error) {
  const code = String(error?.code || "query_error").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32) || "query_error";
  return `Work lookup failed (${code}). Retry or contact Technical Support.`;
}

function group(key, label, items) {
  return { key, label, items: items.filter(Boolean).slice(0, LIMIT) };
}

function roomName(room) {
  if (room?.kind === "project") return room.projects?.name || "Project Room";
  if (room?.kind === "sub_team") return room.sub_teams?.name || "Sub-team Room";
  return room?.units?.name || "Unit Room";
}

function roomContext(room) {
  if (room?.kind === "project") return { kind: "project", projectId: room.project_id };
  if (room?.kind === "sub_team") return { kind: "sub_team", subTeamId: room.sub_team_id };
  return { kind: "unit", unitId: room?.unit_id };
}

export async function searchCeacRecords({ query, me, isAdmin = false, onPartial = null }) {
  const cleaned = cleanQuery(query);
  if (cleaned.length < 2 || !me?.org_id) return [];
  const pattern = `%${cleaned}%`;

  const tasks = [
    supabase.from("work_items")
      .select("id,ref,title,status,project_id")
      .eq("org_id", me.org_id)
      .ilike("title", pattern)
      .limit(LIMIT),
    supabase.from("projects")
      .select("id,name,purpose,status,lead_unit_id")
      .eq("org_id", me.org_id)
      .ilike("name", pattern)
      .limit(LIMIT),
    supabase.from("strategy_nodes")
      .select("id,node_type,name,statement,status,unit_id")
      .eq("org_id", me.org_id)
      .ilike("name", pattern)
      .limit(LIMIT),
    supabase.from("profiles")
      .select("id,full_name,job_title,active")
      .eq("org_id", me.org_id)
      .ilike("full_name", pattern)
      .limit(LIMIT),
    supabase.from("units")
      .select("id,name,code,active")
      .eq("org_id", me.org_id)
      .ilike("name", pattern)
      .limit(LIMIT),
    supabase.from("sub_teams")
      .select("id,name,unit_id,active")
      .eq("org_id", me.org_id)
      .ilike("name", pattern)
      .limit(LIMIT),
    supabase.from("meeting_sessions")
      .select("id,title,starts_at,status")
      .eq("org_id", me.org_id)
      .ilike("title", pattern)
      .order("starts_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("announcements")
      .select("id,title,status,published_at,created_at")
      .eq("org_id", me.org_id)
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("rooms")
      .select("id,kind,unit_id,sub_team_id,project_id,units(name),sub_teams(name),projects(name)")
      .eq("org_id", me.org_id)
      .limit(80),
    supabase.from("operational_files")
      .select("id,filename,mime_type,size_bytes,storage_bucket,storage_path,state,created_at")
      .eq("org_id", me.org_id)
      .eq("state", "active")
      .ilike("filename", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    isAdmin ? supabase.rpc("admin_employee_roster_summary") : Promise.resolve({ data: [], error: null }),
  ];

  // Expose authorised organisation results without waiting for unrelated slow
  // catalogues (or private HR roster reads). A PostgREST thenable must be
  // converted to a Promise once so both the partial result and final aggregate
  // reuse exactly the same authenticated request.
  const unitPromise = Promise.resolve(tasks[4]);
  const subTeamPromise = Promise.resolve(tasks[5]);
  tasks[4] = unitPromise;
  tasks[5] = subTeamPromise;
  if (typeof onPartial === "function") {
    void Promise.all([unitPromise, subTeamPromise]).then(([units, subTeams]) => {
      if (units?.error || subTeams?.error) {
        const code = String((units?.error || subTeams?.error)?.code || "query_error")
          .replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32) || "query_error";
        onPartial([], { source: "organisation", error: `Organisation lookup failed (${code}). Retry or contact Technical Support.` });
        return;
      }
      const items = [
        ...(units?.data || []).map((row) => ({
          kind: "unit", id: row.id, title: row.name,
          meta: row.code ? `Unit · ${row.code}` : "Unit",
          context: { kind: "unit", unitId: row.id }, icon: "organisation",
        })),
        ...(subTeams?.data || []).map((row) => ({
          kind: "sub_team", id: row.id, title: row.name,
          meta: "Sub-team", context: { kind: "sub_team", subTeamId: row.id }, icon: "team",
        })),
      ];
      if (items.length) onPartial([group("organisation", "Organisation", items)]);
    }).catch(() => onPartial([], {
      source: "organisation",
      error: "Organisation lookup failed (query_error). Retry or contact Technical Support.",
    }));
  }

  // Return authorised Work matches independently of slower optional catalogues.
  // A real Promise ensures the PostgREST thenable executes exactly once.
  const workPromise = Promise.resolve(tasks[0]);
  tasks[0] = workPromise;
  if (typeof onPartial === "function") {
    void workPromise.then((result) => {
      if (result?.error) {
        onPartial([], { source: "work", error: safeWorkSearchFailure(result.error) });
        return;
      }
      const rows = safeData(result).map((row) => ({
        kind: "work", id: row.id, title: row.title,
        meta: [row.ref, String(row.status || "").replaceAll("_", " ")].filter(Boolean).join(" · "),
        icon: "work",
      }));
      onPartial(rows.length ? [group("work", "Work", rows)] : []);
    }).catch((error) => onPartial([], { source: "work", error: safeWorkSearchFailure(error) }));
  }

  const [workResult, projectResult, strategyResult, profileResult, unitResult, subTeamResult, meetingResult, announcementResult, roomResult, fileResult, rosterResult] = await Promise.all(tasks);
  if (workResult?.error) throw new Error("Work search could not be verified: " + safeWorkSearchFailure(workResult.error));
  // Never disguise a failed organisation authority check as an empty directory.
  if (unitResult?.error || subTeamResult?.error) {
    throw new Error("Organisation search could not be verified. Retry or contact Technical Support.");
  }

  const work = safeData(workResult).map((row) => ({
    kind: "work",
    id: row.id,
    title: row.title,
    meta: [row.ref, String(row.status || "").replaceAll("_", " ")].filter(Boolean).join(" · "),
    icon: "work",
  }));

  const projects = safeData(projectResult).map((row) => ({
    kind: "project",
    id: row.id,
    title: row.name,
    meta: [row.status, row.purpose].filter(Boolean).join(" · "),
    icon: "projects",
  }));

  const ministry = safeData(strategyResult).map((row) => ({
    kind: "ministry",
    id: row.id,
    title: row.name,
    meta: [String(row.node_type || "").replaceAll("_", " "), row.status].filter(Boolean).join(" · "),
    icon: "ministry",
  }));

  const peopleByKey = new Map();
  safeData(profileResult).forEach((row) => {
    peopleByKey.set(`profile:${row.id}`, {
      kind: "person",
      id: row.id,
      profileId: row.id,
      employeeId: null,
      title: row.full_name,
      meta: row.job_title || "CEAC person",
      icon: "people",
    });
  });
  if (isAdmin) {
    safeData(rosterResult)
      .filter((row) => contains(row.full_name, cleaned) || contains(row.preferred_name, cleaned) || contains(row.job_title, cleaned))
      .forEach((row) => {
        const key = row.profile_id ? `profile:${row.profile_id}` : `employee:${row.id}`;
        peopleByKey.set(key, {
          kind: "person",
          id: row.id,
          profileId: row.profile_id || null,
          employeeId: row.id,
          title: row.full_name,
          meta: [row.job_title, row.source_department_text].filter(Boolean).join(" · ") || "Employee",
          icon: "people",
        });
      });
  }

  const organisation = [
    ...safeData(unitResult).map((row) => ({
      kind: "unit",
      id: row.id,
      title: row.name,
      meta: row.code ? `Unit · ${row.code}` : "Unit",
      context: { kind: "unit", unitId: row.id },
      icon: "organisation",
    })),
    ...safeData(subTeamResult).map((row) => ({
      kind: "sub_team",
      id: row.id,
      title: row.name,
      meta: "Sub-team",
      context: { kind: "sub_team", subTeamId: row.id },
      icon: "team",
    })),
  ];

  const meetings = safeData(meetingResult).map((row) => ({
    kind: "meeting",
    id: row.id,
    title: row.title,
    meta: [row.status, row.starts_at ? new Date(row.starts_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null].filter(Boolean).join(" · "),
    icon: "meeting",
  }));

  const announcements = safeData(announcementResult).map((row) => ({
    kind: "announcement",
    id: row.id,
    title: row.title,
    meta: String(row.status || "announcement").replaceAll("_", " "),
    icon: "messages",
  }));

  const rooms = safeData(roomResult)
    .filter((row) => contains(roomName(row), cleaned))
    .slice(0, LIMIT)
    .map((row) => ({
      kind: "room",
      id: row.id,
      title: roomName(row),
      meta: row.kind === "sub_team" ? "Sub-team Room" : row.kind === "project" ? "Project Room" : "Unit Room",
      context: roomContext(row),
      icon: "messages",
    }));

  const files = safeData(fileResult).map((row) => ({
    kind: "file",
    id: row.id,
    title: row.filename,
    meta: row.mime_type || "File",
    file: row,
    icon: "file",
  }));

  return [
    group("work", "Work", work),
    group("projects", "Projects", projects),
    group("ministry", "Ministry", ministry),
    group("people", "People", [...peopleByKey.values()]),
    group("organisation", "Organisation", organisation),
    group("meetings", "Meetings", meetings),
    group("announcements", "Announcements", announcements),
    group("rooms", "Rooms", rooms),
    group("files", "Files", files),
  ].filter((entry) => entry.items.length);
}
