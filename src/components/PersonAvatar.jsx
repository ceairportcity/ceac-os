import { useEffect, useState } from "react";
import "./PersonAvatar.css";

/**
 * Authorised CEAC staff avatar. Stock faces are NEVER substitutes for an
 * employee photograph. Only signed CEAC Storage URLs or local assets can render.
 */
const initials = (name) => String(name || "").trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";

function permittedPortraitUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = new URL(value, window.location.origin);
    const appOrigin = window.location.origin;
    const storageBase = import.meta.env.VITE_SUPABASE_URL;
    const storageOrigin = storageBase ? new URL(storageBase).origin : "";
    if (parsed.protocol === "https:" &&
      (parsed.origin === appOrigin || (storageOrigin && parsed.origin === storageOrigin))) {
      return parsed.href;
    }
    if (parsed.protocol === "http:" && parsed.origin === appOrigin) return parsed.href;
  } catch { /* invalid or unsupported photo source */ }
  return null;
}

export default function PersonAvatar({ name, photoUrl = null, size = 34, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUrl]);
  const src = permittedPortraitUrl(photoUrl);
  return <span className={`s2-person-avatar ${className}`} aria-hidden="true"
    style={{ "--s2-avatar-size": `${size}px` }}>
    {src && !failed
      ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : initials(name)}
  </span>;
}
