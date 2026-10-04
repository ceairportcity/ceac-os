import { useEffect, useState } from "react";
import {
  OPERATIONAL_FILE_ACCEPT,
  formatOperationalFileSize,
  listOperationalFiles,
  openOperationalFile,
  signedOperationalFileUrl,
  uploadOperationalFiles,
  validateOperationalFile,
} from "../lib/operationalFiles";

export function PendingFilePicker({ files, onChange, label = "Attach files", disabled = false }) {
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
    <label className="btn btn-ghost btn-sm">
      {label}
      <input type="file" multiple accept={OPERATIONAL_FILE_ACCEPT} onChange={add} disabled={disabled} style={{ display:"none" }} />
    </label>
    {(files || []).length > 0 && <div style={{ display:"grid", gap:6, marginTop:8 }}>
      {files.map((file) => <div className="row" key={file.name + ":" + file.size}>
        <div className="row-t">{file.name}</div>
        <div className="row-m">{formatOperationalFileSize(file.size)} · ready to upload</div>
        <button className="text-action" type="button" onClick={() => onChange?.(files.filter((entry) => entry !== file))}>Remove</button>
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

  useEffect(() => { load(); }, [contextType, contextId]);

  async function load() {
    if (!contextId) { setRows([]); return; }
    setError(null);
    try {
      setRows(await listOperationalFiles(contextType, contextId));
    } catch (err) {
      setError(err.message || "Files could not be loaded.");
      setRows([]);
    }
  }

  async function add(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setBusy(true); setError(null);
    try {
      await uploadOperationalFiles({ files, contextType, contextId, relation });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || "The file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function open(file) {
    setError(null);
    try { await openOperationalFile(file); }
    catch (err) { setError(err.message || "The file could not be opened."); }
  }

  return <section className="operational-files">
    <div className="sec"><span>{title}</span><span>{rows.length}</span></div>
    {canUpload && <label className="btn btn-ghost btn-sm" style={{ marginBottom:10 }}>
      {busy ? "Uploading…" : "Upload file"}
      <input type="file" multiple accept={OPERATIONAL_FILE_ACCEPT} onChange={add} disabled={busy} style={{ display:"none" }} />
    </label>}
    {error && <div className="hint" role="alert">{error}</div>}
    {!rows.length && !error && <div className="card small">{emptyText}</div>}
    {rows.map((file) => <button type="button" className="row" key={file.link_id || file.id} onClick={() => open(file)}>
      <div className="row-t">{file.filename}</div>
      <div className="row-m">{formatOperationalFileSize(file.size_bytes)} · {file.mime_type}</div>
      <div className="row-note">Private CEAC file · open with a short-lived signed link</div>
    </button>)}
  </section>;
}


export function OperationalMediaList({ files = [] }) {
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      if (!files.length) { setUrls({}); return; }
      try {
        const pairs = await Promise.all(files.map(async (file) => [file.id, await signedOperationalFileUrl(file, 300)]));
        if (!cancelled) { setUrls(Object.fromEntries(pairs)); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err.message || "Private media could not be prepared.");
      }
    }
    loadUrls();
    return () => { cancelled = true; };
  }, [files.map((file) => file.id).join("|")]);

  if (!files.length) return null;
  return <div className="operational-media-list">
    {files.map((file) => {
      const url = urls[file.id];
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
      return <button type="button" className="operational-media-file" key={file.id} onClick={() => openOperationalFile(file)}>
        <strong>{file.filename}</strong><span>{formatOperationalFileSize(file.size_bytes)} · private CEAC file</span>
      </button>;
    })}
    {error && <div className="hint" role="alert">{error}</div>}
  </div>;
}
