import { supabase } from "./supabase";

export const PORTRAIT_BUCKET = "ceac-profile-portraits";

/**
 * RLS-bound photos for actually assigned CEAC staff. Never fetches arbitrary
 * profile IDs outside the current project and never uses a public bucket.
 * Authenticated signed URLs expire automatically after one hour.
 */
export async function signedProjectPortraits(profileIds) {
  const ids = [...new Set(profileIds.filter((id) =>
    typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return {};
  if (ids.length > 150) throw new Error("Too many project portrait requests");
  const response = await supabase.from("profile_portraits")
    .select("profile_id,object_path").in("profile_id", ids);
  if (response.error) throw response.error;
  const records = response.data || [];
  if (!records.length) return {};
  const paths = records.map((row) => row.object_path);
  const signed = await supabase.storage.from(PORTRAIT_BUCKET).createSignedUrls(paths, 3600);
  if (signed.error) throw signed.error;
  const result = {};
  for (let i = 0; i < records.length; i++) {
    const url = signed.data?.[i]?.signedUrl;
    if (url && !signed.data[i]?.error) result[records[i].profile_id] = url;
  }
  return result;
}
