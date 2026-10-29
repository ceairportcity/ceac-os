import { supabase } from "./supabase";

export const OPERATIONAL_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const OPERATIONAL_FILE_ACCEPT = [
  "image/jpeg","image/png","image/webp","image/gif",
  "application/pdf","text/plain","text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "audio/mpeg","audio/mp4","audio/wav","audio/x-wav","audio/ogg",
  "video/mp4","video/webm",
].join(",");

const ALLOWED_TYPES = new Set(OPERATIONAL_FILE_ACCEPT.split(","));

export function validateOperationalFile(file) {
  if (!file) throw new Error("Choose a file.");
  if (!file.name || file.name.trim().length > 240) throw new Error("File names can be up to 240 characters.");
  if (!file.size || file.size > OPERATIONAL_FILE_MAX_BYTES) throw new Error("Files can be up to 50 MB.");
  if (!ALLOWED_TYPES.has(String(file.type || "").toLowerCase())) throw new Error("That file type is not supported.");
  return file;
}

export async function uploadOperationalFile({ file, contextType, contextId, relation, retryState }) {
  validateOperationalFile(file);
  const scope=JSON.stringify([contextType,contextId,relation,file.name,file.size,file.type]);
  if(retryState?.scope && retryState.scope!==scope)throw new Error("The upload context changed. Choose the file again.");
  const registration = retryState?.registration ? {data:retryState.registration} : await supabase.rpc("register_operational_file", {
    p_context_type: contextType,
    p_context_id: contextId,
    p_relation: relation,
    p_filename: file.name,
    p_mime_type: file.type,
    p_size_bytes: file.size,
  });
  if (registration.error) throw registration.error;
  const row = Array.isArray(registration.data) ? registration.data[0] : registration.data;
  if (!row?.file_id || !row?.storage_path || !row?.storage_bucket) throw new Error("CEAC could not prepare the private file upload.");
  if(retryState){retryState.scope=scope;retryState.registration=row;}

  if(!retryState?.uploaded){
   const upload = await supabase.storage.from(row.storage_bucket).upload(row.storage_path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
   // A retry may find bytes whose successful response was interrupted. Never
   // overwrite them; the finaliser verifies the registered private object.
   if (upload.error && !(retryState && String(upload.error.statusCode)==="409")) throw upload.error;
   if(retryState)retryState.uploaded=true;
  }

  const finalise = await supabase.rpc("finalize_operational_file", { p_file_id: row.file_id });
  if (finalise.error) {
    if(!retryState)throw finalise.error;
    const check=await supabase.from("operational_files").select("id,state").eq("id",row.file_id).maybeSingle();
    if(check.error || check.data?.id!==row.file_id || check.data.state!=="active")throw finalise.error;
  }
  return row.file_id;
}

export async function uploadOperationalFiles({ files, contextType, contextId, relation }) {
  const uploaded = [];
  for (const file of files || []) {
    uploaded.push(await uploadOperationalFile({ file, contextType, contextId, relation }));
  }
  return uploaded;
}

export async function listOperationalFiles(contextType, contextId) {
  if (!contextType || !contextId) return [];
  const result = await supabase.from("operational_file_links")
    .select("id,relation,created_at,file:operational_files!inner(id,filename,mime_type,size_bytes,storage_bucket,storage_path,state,created_at,uploaded_by)")
    .eq("context_type", contextType)
    .eq("context_id", contextId)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map((row) => ({ ...row.file, link_id: row.id, relation: row.relation, linked_at: row.created_at }));
}

export async function listOperationalFilesForContexts(contextType, contextIds = []) {
  const ids = [...new Set((contextIds || []).filter(Boolean))];
  const grouped = new Map(ids.map((id) => [id, []]));
  if (!contextType || !ids.length) return grouped;
  const result = await supabase.from("operational_file_links")
    .select("id,context_id,relation,created_at,file:operational_files!inner(id,filename,mime_type,size_bytes,storage_bucket,storage_path,state,created_at,uploaded_by)")
    .eq("context_type", contextType)
    .in("context_id", ids)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  for (const row of result.data || []) {
    if (!grouped.has(row.context_id)) grouped.set(row.context_id, []);
    grouped.get(row.context_id).push({ ...row.file, link_id: row.id, relation: row.relation, linked_at: row.created_at });
  }
  return grouped;
}

export async function linkOperationalFile({ fileId, contextType, contextId, relation }) {
  const result = await supabase.rpc("link_operational_file", {
    p_file_id: fileId,
    p_context_type: contextType,
    p_context_id: contextId,
    p_relation: relation,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function signedOperationalFileUrl(file, expiresIn = 300) {
  const result = await supabase.storage.from(file.storage_bucket || "ceac-operational-private")
    .createSignedUrl(file.storage_path, expiresIn, { download: false });
  if (result.error) throw result.error;
  if (!result.data?.signedUrl) throw new Error("CEAC could not open that private file.");
  return result.data.signedUrl;
}

export async function openOperationalFile(file) {
  const signedUrl = await signedOperationalFileUrl(file, 300);
  window.open(signedUrl, "_blank", "noopener,noreferrer");
}

export function formatOperationalFileSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
