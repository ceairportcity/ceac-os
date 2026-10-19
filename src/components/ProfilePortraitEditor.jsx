import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import PersonAvatar from "./PersonAvatar";
import "./ProfilePortraitEditor.css";

const BUCKET = "ceac-profile-portraits";
const MAX_FILE = 8 * 1024 * 1024;
const MAX_WEBP = 1024 * 1024;

async function preparePortrait(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file?.type))
    throw new Error("Choose a JPEG, PNG or WebP photograph.");
  if (!file.size || file.size > MAX_FILE)
    throw new Error("Choose a photograph smaller than 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is unavailable in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    const size = Math.min(bitmap.width, bitmap.height);
    const left = (bitmap.width - size) / 2;
    const top = (bitmap.height - size) / 2;
    ctx.drawImage(bitmap, left, top, size, size, 0, 0, 512, 512);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .77));
    if (!blob || blob.type !== "image/webp" || blob.size > MAX_WEBP)
      throw new Error("Photo could not be converted safely to a small WebP. Choose another image.");
    return blob;
  } finally { bitmap.close(); }
}

/** User-controlled photo, private to active same-organisation AAL2 accounts.
 * Requires the separately approved Stage 2 portrait migration + Auth cutover.
 */
export default function ProfilePortraitEditor({ me }) {
  const [path, setPath] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("profile_portraits")
          .select("object_path").eq("profile_id", me.id).maybeSingle();
        if (error) throw error;
        if (!alive) return;
        setPath(data?.object_path || null);
        if (data?.object_path) {
          const signed = await supabase.storage.from(BUCKET).createSignedUrl(data.object_path, 900);
          if (alive && !signed.error) setUrl(signed.data?.signedUrl || null);
        }
      } catch { if (alive) setMessage("Your current profile photograph could not be verified."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [me.id]);

  async function upload(file) {
    if (!file || busy) return;
    setBusy(true); setMessage("");
    let nextPath;
    let saved = false;
    try {
      const image = await preparePortrait(file);
      nextPath = me.org_id + "/" + me.id + "/" + crypto.randomUUID() + ".webp";
      const result = await supabase.storage.from(BUCKET).upload(nextPath, image, {
        contentType: "image/webp", upsert: false, cacheControl: "300",
      });
      if (result.error) throw result.error;
      const pointer = await supabase.from("profile_portraits").upsert({
        profile_id: me.id, org_id: me.org_id, object_path: nextPath,
      }, { onConflict: "profile_id" });
      if (pointer.error) throw pointer.error;
      saved = true;
      const priorPath = path;
      setPath(nextPath);
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(nextPath, 900);
      setUrl(signed.error ? null : signed.data?.signedUrl || null);
      if (priorPath && priorPath !== nextPath) {
        // Failure to remove the superseded private object must not erase a
        // successful pointer update; it remains inaccessible outside RLS.
        await supabase.storage.from(BUCKET).remove([priorPath]);
      }
      setMessage("Saved. Your authorised CEAC colleagues can now see your profile photograph.");
    } catch (error) {
      if (nextPath && !saved) await supabase.storage.from(BUCKET).remove([nextPath]);
      setMessage(error?.message || "Could not save your photo.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!path || busy) return;
    setBusy(true); setMessage("");
    try {
      const former = path;
      const result = await supabase.from("profile_portraits").delete().eq("profile_id", me.id);
      if (result.error) throw result.error;
      setPath(null); setUrl(null);
      await supabase.storage.from(BUCKET).remove([former]);
      setMessage("Profile photograph removed. Your initials will appear instead.");
    } catch (error) { setMessage(error?.message || "Could not remove your photograph."); }
    finally { setBusy(false); }
  }

  return <section className="s2-profile-photo-editor" aria-label="Your CEAC profile photograph">
    <PersonAvatar name={me.full_name} photoUrl={url} size={66} />
    <div className="s2-profile-photo-copy">
      <strong>Profile photograph</strong>
      <p>Optional. Visible only to authorised CEAC colleagues. Your photograph will also appear beside your project responsibilities.</p>
      <div className="s2-profile-photo-actions">
        <label className={busy ? "is-disabled" : ""}>
          {busy ? "Saving photograph…" : loading ? "Checking…" : path ? "Change photograph" : "Add photograph"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || loading}
            aria-label="Choose your profile photograph"
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload(file); }} />
        </label>
        {path && <button type="button" onClick={remove} disabled={busy || loading}>Remove</button>}
      </div>
      {message && <p role="status" className="s2-profile-photo-notice">{message}</p>}
    </div>
  </section>;
}
