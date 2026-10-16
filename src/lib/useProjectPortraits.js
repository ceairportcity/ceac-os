import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

/**
 * Authorised, short-lived staff portrait URLs.
 * Reads one viewer-scoped private portrait pointer per project assignee, then
 * asks Supabase Storage for a temporary signed URL under its own RLS.
 * Always fail closed to initials; never fetch or cache another user's secrets.
 *
 * The private portrait bucket and AAL2 policies are Stage 2 only. Until the
 * separately approved Auth/database cutover, do not query a nonexistent table.
 */
export function useProjectPortraits(project) {
  const enabled = import.meta.env.VITE_STAGE2_UNIVERSAL_AAL2 === "true";
  const ids = useMemo(() => [...new Set((project?.work || [])
    .map((item) => item.assignee_id).filter(Boolean))].sort().slice(0, 100),
    [project?.work]);
  const idKey = ids.join(",");
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let alive = true;
    setUrls({});
    if (!enabled || !idKey) return () => { alive = false; };
    async function load() {
      try {
        const { data, error } = await supabase.from("profile_portraits")
          .select("profile_id,object_path").in("profile_id", ids);
        if (error) return;
        const pairs = await Promise.all((data || []).map(async (item) => {
          const result = await supabase.storage.from("ceac-profile-portraits")
            .createSignedUrl(item.object_path, 900);
          return result.error || !result.data?.signedUrl ? null
            : [item.profile_id, result.data.signedUrl];
        }));
        if (alive) setUrls(Object.fromEntries(pairs.filter(Boolean)));
      } catch {
        if (alive) setUrls({});
      }
    }
    load();
    // Supabase signed media expires after 15 minutes; refresh before expiry.
    const ticker = setInterval(load, 12 * 60 * 1000);
    return () => { alive = false; clearInterval(ticker); };
  }, [enabled, idKey, project?.id]);

  return urls;
}
