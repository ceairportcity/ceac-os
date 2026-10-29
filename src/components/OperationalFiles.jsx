import { useEffect, useRef, useState } from "react";
import {
  OPERATIONAL_FILE_ACCEPT,
  formatOperationalFileSize,
  listOperationalFiles,
  openOperationalFile,
  signedOperationalFileUrl,
  uploadOperationalFiles,
  validateOperationalFile,
} from "../lib/operationalFiles";

export function PendingFilePicker({ files, onChange, label = "Attach files", disabled = false, compact = false }) {
  const [error, setError] = useState(null);

  function add(event) {
    const next = [...(event.target.files || [])];
    event.target.value = "";
    try {
      next.forEach(validateOperationalFile);
      const keyed = new Map((files || []).map((file) => [file.name + ":" + file.size, file]));
      next.forEach((file) => keyed.set(file.name + ":" + file.size, file));
      onChange?.([...keyed.values()]);
      setError(null);
    } catch (err) {
      setError(err.message || "That file could not be added.");
    }
  }

  return <div className="operational-files-picker">
    <label className="btn btn-ghost btn-sm" style={compact?{width:"fit-content"}:undefined}>
      {label}
      <input type="file" multiple accept={OPERATIONAL_FILE_ACCEPT} onChange={add} disabled={disabled} style={{ display:"none" }} />
    </label>
    {(files || []).length > 0 && <div style={{ display:"grid", gap:6, marginTop:8 }}>
      {files.map((file) => <div className={compact?undefined:"row"} style={compact?{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}:undefined} key={file.name + ":" + file.size}>
        <div className="row-t" style={compact?{minWidth:0,overflowWrap:"anywhere",flex:"1 1 160px"}:undefined}>{file.name}</div>
        <div className="row-m">{formatOperationalFileSize(file.size)} · ready to upload</div>
        <button className="text-action" type="button" disabled={disabled} onClick={() => onChange?.(files.filter((entry) => entry !== file))}>Remove</button>
      </div>)}
    </div>}
    {error && <div className="hint" role="alert">{error}</div>}
  </div>;
}

export function OperationalFileList({
  contextType,
  contextId,
  relation,
  canUpload = false,
  title = "Files",
  emptyText = "No files recorded.",
  onChanged,
}) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loadedContext, setLoadedContext] = useState(null);
  // Context identity is checked during render as well as in async callbacks:
  // old private attachments must never flash while a new case loads.
  const contextKey = `${contextType || ""}:${contextId || ""}`;
  const readGeneration = useRef(0);
  const scopeGeneration = useRef(0);
  const writeBusy = useRef(false);
  const verified = loadedContext === contextKey;
  const visibleRows = verified ? rows : [];
  const visibleError = verified ? error : null;

  useEffect(() => {
    scopeGeneration.current += 1;
    writeBusy.current = false;
    setBusy(false);
    void load();
    return () => { scopeGeneration.current += 1; readGeneration.current += 1; };
  }, [contextKey]);

  async function load() {
    const generation = ++readGeneration.current;
    setLoadedContext(null);
    setRows([]);
    setError(null);
    if (!contextType || !contextId) {
      if (generation === readGeneration.current) setLoadedContext(contextKey);
      return;
    }
    try {
      const latest = await listOperationalFiles(contextType, contextId);
      if (generation === readGeneration.current) setRows(latest);
    } catch (err) {
      if (generation === readGeneration.current) {
        setError(err.message || "Files could not be loaded.");
      }
    } finally {
      if (generation === readGeneration.current) setLoadedContext(contextKey);
    }
  }

  async function add(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || !canUpload || !verified || !contextId || writeBusy.current) return;
    const scopeGenerationAtStart = scopeGeneration.current;
    writeBusy.current = true;
    setBusy(true); setError(null);
    try {
      await uploadOperationalFiles({ files, contextType, contextId, relation });
      if (scopeGenerationAtStart !== scopeGeneration.current) return;
      await load();
      if (scopeGenerationAtStart === scopeGeneration.current) onChanged?.();
    } catch (err) {
      if (scopeGenerationAtStart === scopeGeneration.current) {
        setError(err.message || "The file could not be uploaded.");
      }
    } finally {
      if (scopeGenerationAtStart === scopeGeneration.current) {
        writeBusy.current = false; setBusy(false);
      }
    }
  }

  async function open(file) {
    if (!verified) return;
    const scopeGenerationAtStart = scopeGeneration.current;
    setError(null);
    try {
      const url = await signedOperationalFileUrl(file, 300);
      if (scopeGenerationAtStart === scopeGeneration.current) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (scopeGenerationAtStart === scopeGeneration.current) {
        setError(err.message || "The file could not be opened.");
      }
    }
  }

  return <section className="operational-files">
    <div className="sec"><span>{title}</span><span>{visibleRows.length}</span></div>
    {canUpload && <label className="btn btn-ghost btn-sm" style={{ marginBottom:10 }}>
      {busy ? "Uploading…" : "Upload file"}
      <input type="file" multiple accept={OPERATIONAL_FILE_ACCEPT} onChange={add}
        disabled={busy || !verified || !contextId || Boolean(visibleError)} style={{ display:"none" }} />
    </label>}
    {!verified && <div role="status" className="hint">Checking authorised private files…</div>}
    {visibleError && <div className="hint" role="alert">
      {visibleError} <button type="button" className="text-action" onClick={() => void load()}>Retry private files</button>
    </div>}
    {verified && !visibleRows.length && !visibleError && <div className="card small">{emptyText}</div>}
    {visibleRows.map((file) => <button type="button" className="row" key={file.link_id || file.id} onClick={() => open(file)}>
      <div className="row-t">{file.filename}</div>
      <div className="row-m">{formatOperationalFileSize(file.size_bytes)} · {file.mime_type}</div>
      <div className="row-note">Private CEAC file · open with a short-lived signed link</div>
    </button>)}
  </section>;
}


export function OperationalMediaList({ files = [] }) {
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);
  const [loadedMediaKey, setLoadedMediaKey] = useState(null);
  const [retry, setRetry] = useState(0);
  // Same file ID must not accidentally reuse a signed URL for a changed
  // private storage object. Never render URL state from a previous file set.
  const mediaKey = files.map((file) => [
    file.id, file.storage_bucket || "", file.storage_path || "",
  ].join(":")).join("|");
  const safeUrls = loadedMediaKey === mediaKey ? urls : {};
  const activeMediaKey = useRef(mediaKey);
  activeMediaKey.current = mediaKey;

  useEffect(() => {
    let cancelled = false;
    setUrls({}); setError(null); setLoadedMediaKey(null);
    async function loadUrls() {
      if (!files.length) {
        if (!cancelled) setLoadedMediaKey(mediaKey);
        return;
      }
      try {
        const pairs = await Promise.all(files.map(async (file) => [
          file.id, await signedOperationalFileUrl(file, 300),
        ]));
        if (!cancelled) { setUrls(Object.fromEntries(pairs)); setLoadedMediaKey(mediaKey); }
      } catch (err) {
        if (!cancelled) {
          setUrls({});
          setError(err.message || "Private media could not be prepared.");
          setLoadedMediaKey(mediaKey);
        }
      }
    }
    void loadUrls();
    return () => { cancelled = true; };
  }, [mediaKey, retry]);

  async function openMedia(file) {
    if (loadedMediaKey !== mediaKey) return;
    const expectedKey = mediaKey;
    try {
      const url = await signedOperationalFileUrl(file, 300);
      if (activeMediaKey.current === expectedKey) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (activeMediaKey.current === expectedKey) {
        setError(err.message || "The private media file could not be opened.");
      }
    }
  }

  if (!files.length) return null;
  return <div className="operational-media-list">
    {loadedMediaKey !== mediaKey && <div role="status" className="hint">Checking private media…</div>}
    {files.map((file) => {
      const url = safeUrls[file.id];
      if (file.mime_type?.startsWith("image/") && url) return <figure className="operational-media-image" key={file.id}>
        <img src={url} alt={file.filename} loading="lazy" />
        <figcaption>{file.filename} · {formatOperationalFileSize(file.size_bytes)}</figcaption>
      </figure>;
      if (file.mime_type?.startsWith("audio/") && url) return <div className="operational-media-audio" key={file.id}>
        <strong>{file.filename}</strong><audio controls preload="metadata" src={url} />
      </div>;
      if (file.mime_type?.startsWith("video/") && url) return <div className="operational-media-video" key={file.id}>
        <video controls preload="metadata" src={url} aria-label={file.filename} />
        <span>{file.filename}</span>
      </div>;
      return <button type="button" className="operational-media-file" key={file.id}
        disabled={loadedMediaKey !== mediaKey} onClick={() => void openMedia(file)}>
        <strong>{file.filename}</strong><span>{formatOperationalFileSize(file.size_bytes)} · private CEAC file</span>
      </button>;
    })}
    {error && loadedMediaKey === mediaKey && <div className="hint" role="alert">
      {error} <button type="button" className="text-action" onClick={() => setRetry((n) => n + 1)}>
        Retry private media
      </button>
    </div>}
  </div>;
}
