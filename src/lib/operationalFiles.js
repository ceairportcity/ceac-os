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

export async function uploadOperationalFile({ file, contextType, contextId, relation }) {
  validateOperationalFile(file);
  const registration = await supabase.rpc("register_operational_file", {
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

  const upload = await supabase.storage.from(row.storage_bucket).upload(row.storage_path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const finalise = await supabase.rpc("finalize_operational_file", { p_file_id: row.file_id });
  if (finalise.error) throw finalise.error;
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

export async function openOperationalFile(file) {
  const result = await supabase.storage.from(file.storage_bucket || "ceac-operational-private")
    .createSignedUrl(file.storage_path, 300, { download: file.filename || true });
  if (result.error) throw result.error;
  if (!result.data?.signedUrl) throw new Error("CEAC could not open that private file.");
  window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
}

export function formatOperationalFileSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
