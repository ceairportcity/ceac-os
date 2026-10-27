import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, ProductNotice, Sheet } from "../components/bits";
import { ComposerDrawer } from "../experience-v2/components";
import VoiceInput from "../components/VoiceInput";
import { OperationalFileList, PendingFilePicker } from "../components/OperationalFiles";
import { uploadOperationalFiles } from "../lib/operationalFiles";

const ROLE_OPTIONS = [
  ["staff", "Staff"], ["sub_team_lead", "Team leads"], ["manager", "Unit heads"],
  ["admin", "Administration"], ["exec", "Group Pastor"],
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

function blankForm() {
  return { id: null, title: "", body: "", priority: "normal", requiresAck: false, expiresAt: "", allOrg: true, unitIds: [], roles: [], files: [], audienceMode: "everyone" };
}

export default function Announcements({ me, back, createRequest = false, onCreateHandled, initialAnnouncementId = null, onInitialHandled }) {
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const grantedCanPublish = Boolean(me.is_admin || me.is_exec || (me.capability_grants || []).some((grant) => grant.capability === "post_announcement" && !grant.scope_unit_id));
  const [canPublish, setCanPublish] = useState(grantedCanPublish);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id]);
  useEffect(() => {
    if (!initialAnnouncementId || !rows.length || selected) return;
    const match = rows.find((row) => row.id === initialAnnouncementId);
    if (!match) return;
    openAnnouncement(match);
    onInitialHandled?.();
  }, [initialAnnouncementId, rows, selected]);
  useEffect(() => {
    if (createRequest && canPublish) {
      // A delayed create intent must not erase a draft already being typed.
      setForm((current) => current ?? blankForm());
      onCreateHandled?.();
    }
  }, [createRequest, canPublish]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [announcementResult, unitResult] = await Promise.all([
        supabase.from("announcements")
          .select("id,title,body,priority,status,requires_acknowledgement,published_at,expires_at,created_at,profiles!announcements_author_id_fkey(full_name),announcement_receipts(profile_id,read_at,acknowledged_at),announcement_audiences(id,audience_type,unit_id,audience_role,units(name))")
          .order("created_at", { ascending: false }),
        supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("position"),
      ]);
      if (announcementResult.error) throw new Error(`Announcements: ${announcementResult.error.message}`);
      if (unitResult.error) throw new Error(`Units: ${unitResult.error.message}`);
      const announcements = announcementResult.data || [];
      setCanPublish(grantedCanPublish);
      setUnits(unitResult.data || []);
      if (grantedCanPublish) {
        const withCounts = await Promise.all(announcements.map(async (announcement) => {
          const { data, error: countError } = await supabase.rpc("announcement_audience_counts", { p_announcement_id: announcement.id });
          if (countError) throw new Error(`Announcement counts: ${countError.message}`);
          return { ...announcement, counts: data?.[0] || { target_count: 0, read_count: 0, acknowledged_count: 0 } };
        }));
        setRows(withCounts);
      } else setRows(announcements);
    } catch (err) { setError(err.message || "Announcements could not be loaded."); setRows([]); }
    finally { setLoading(false); }
  }

  function receiptFor(announcement) {
    return (announcement.announcement_receipts || []).find((receipt) => receipt.profile_id === me.id) || null;
  }

  async function openAnnouncement(announcement) {
    setError(null);
    try {
      if (announcement.status === "published") {
        const { data, error: readError } = await supabase.rpc("mark_announcement_read", { p_announcement_id: announcement.id, p_acknowledge: false });
        if (readError) throw readError;
        announcement = { ...announcement, announcement_receipts: [data] };
        setRows((current) => current.map((row) => row.id === announcement.id ? announcement : row));
      }
      setSelected(announcement);
    } catch (err) { setError(err.message || "The announcement could not be opened."); }
  }

  async function acknowledge() {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      const { data, error: ackError } = await supabase.rpc("mark_announcement_read", { p_announcement_id: selected.id, p_acknowledge: true });
      if (ackError) throw ackError;
      const next = { ...selected, announcement_receipts: [data] };
      setSelected(next);
      setRows((current) => current.map((row) => row.id === next.id ? next : row));
    } catch (err) { setError(err.message || "The acknowledgement could not be saved."); }
    finally { setBusy(false); }
  }

  function editAnnouncement(announcement) {
    const audiences = announcement.announcement_audiences || [];
    const allOrg = audiences.some((audience) => audience.audience_type === "organisation");
    const unitIds = audiences.filter((audience) => audience.audience_type === "unit").map((audience) => audience.unit_id);
    const roles = audiences.filter((audience) => audience.audience_type === "role").map((audience) => audience.audience_role);
    setForm({
      id: announcement.id, title: announcement.title, body: announcement.body, priority: announcement.priority,
      requiresAck: announcement.requires_acknowledgement,
      expiresAt: announcement.expires_at ? new Date(announcement.expires_at).toISOString().slice(0, 16) : "",
      allOrg, unitIds, roles, files: [],
      audienceMode: allOrg ? "everyone" : unitIds.length ? "departments" : "roles",
    });
  }

  function toggleList(field, value) {
    setForm((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((entry) => entry !== value) : [...current[field], value] }));
  }

  async function saveDraft() {
    setBusy(true); setError(null);
    try {
      const args = {
        p_title: form.title.trim(), p_body: form.body.trim(), p_priority: form.priority,
        p_requires_acknowledgement: form.requiresAck,
        p_expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        p_all_org: form.allOrg, p_unit_ids: form.unitIds, p_roles: form.roles,
      };
      const result = form.id
        ? await supabase.rpc("update_announcement", { p_announcement_id: form.id, ...args })
        : await supabase.rpc("create_announcement", args);
      if (result.error) throw result.error;
      const announcementId = form.id || result.data;
      if (form.files?.length && announcementId) {
        try {
          await uploadOperationalFiles({
            files: form.files,
            contextType: "announcement",
            contextId: announcementId,
            relation: "announcement_attachment",
          });
        } catch (fileError) {
          if (!form.id) setForm((current) => ({ ...current, id: announcementId }));
          await load();
          throw new Error(`The announcement draft was saved, but ${fileError.message || "one or more attachments could not be uploaded."}`);
        }
      }
      setForm(null); await load();
    } catch (err) { setError(err.message || "The draft could not be saved."); }
    finally { setBusy(false); }
  }

  async function changeStatus(announcement, action) {
    setBusy(true); setError(null);
    try {
      const { error: actionError } = await supabase.rpc(action === "publish" ? "publish_announcement" : "close_announcement", { p_announcement_id: announcement.id });
      if (actionError) throw actionError;
      setSelected(null); await load();
    } catch (err) { setError(err.message || "The announcement status could not be changed."); }
    finally { setBusy(false); }
  }

  const DetailSurface = me.is_admin ? ComposerDrawer : Sheet;
  return <div className={me.is_exec ? "body exec-redesign-page exec-announcements" : "body"}>
    <header className={me.is_exec ? "exec-redesign-shared-head" : undefined} style={me.is_exec ? undefined : { paddingTop: 26 }}>
      <div>
      {back && <button className="back" onClick={back}>← Back</button>}
      <div className="eyebrow">Organisation communication</div>
      <h1 className="h1" style={me.is_exec ? undefined : { marginTop: 6 }}>Announcements</h1>
      <p className="screen-note">Important messages for the organisation, your role or your unit.</p>
      </div>
      {canPublish && <button className="btn" style={me.is_exec ? undefined : { marginTop: 14, width: "fit-content", alignSelf: "flex-start" }} onClick={() => setForm(blankForm())}>New announcement</button>}
    </header>

    {error && <div className="flag flag-brick" style={{ marginTop: 14 }}><h4>Could not complete that</h4>{error}<button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={load}>Try again</button></div>}
    {loading && <div className="spin">Loading announcements...</div>}
    {!loading && <div style={{ marginTop: 18 }}>
      {rows.length === 0 && !error && <div className="card small">There are no current announcements for you.</div>}
      {rows.map((announcement) => {
        const receipt = receiptFor(announcement);
        const unread = announcement.status === "published" && !receipt;
        return <div className={`row ${unread ? "home-tone-info" : ""}`} key={announcement.id}>
          <button style={{ width: "100%", textAlign: "left" }} onClick={() => openAnnouncement(announcement)}>
            <div className="row-t">{unread ? "New · " : ""}{announcement.title}</div>
            <div className="row-m">{announcement.priority !== "normal" ? `${announcement.priority} · ` : ""}{announcement.status} · {announcement.profiles?.full_name || "CEAC"}</div>
            <div className="row-note">{announcement.published_at ? formatDate(announcement.published_at) : `Drafted ${formatDate(announcement.created_at)}`}</div>
          </button>
          {canPublish && <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
            {announcement.status === "draft" && <><button className="btn btn-ghost btn-sm" onClick={() => editAnnouncement(announcement)}>Edit</button><button className="btn btn-sm" onClick={() => changeStatus(announcement, "publish")} disabled={busy}>Publish</button></>}
            {announcement.status === "published" && <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(announcement, "close")} disabled={busy}>Close</button>}
            <span className="row-m">{announcement.counts?.read_count || 0} read{announcement.requires_acknowledgement ? ` · ${announcement.counts?.acknowledged_count || 0} of ${announcement.counts?.target_count || 0} acknowledged` : ""}</span>
          </div>}
        </div>;
      })}
    </div>}

    {selected && <DetailSurface open title={me.is_admin ? selected.title : undefined} onClose={() => { if (!busy) setSelected(null); }}>
      {me.is_admin && error && <ProductNotice tone="error" title="Announcement update">{error}</ProductNotice>}
      <div className="eyebrow">{selected.priority}{selected.status !== "published" ? ` · ${selected.status}` : ""}</div>
      {!me.is_admin && <div className="h2" style={{ marginTop: 5 }}>{selected.title}</div>}
      <div className="row-m">{selected.profiles?.full_name || "CEAC"} · {formatDate(selected.published_at || selected.created_at)}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 18 }}>{selected.body}</div>
      <OperationalFileList
        contextType="announcement"
        contextId={selected.id}
        relation="announcement_attachment"
        title="Attachments"
        emptyText="No announcement attachments."
      />
      {selected.expires_at && <div className="hint">Available until {formatDate(selected.expires_at)}</div>}
      {selected.requires_acknowledgement && !receiptFor(selected)?.acknowledged_at && selected.status === "published" &&
        <button className="btn" style={{ marginTop: 18 }} onClick={acknowledge} disabled={busy}>{busy ? "Saving..." : "I acknowledge this message"}</button>}
      {receiptFor(selected)?.acknowledged_at && <div className="flag flag-green" style={{ marginTop: 18 }}><h4>Acknowledged</h4>{formatDate(receiptFor(selected).acknowledged_at)}</div>}
    </DetailSurface>}

    {form && <ComposerDrawer
      open
      onClose={() => !busy && setForm(null)}
      title={form.id ? "Edit announcement draft" : "New announcement"}
      description={null}
      panelClassName="reference-composer reference-announcement-composer"
      footer={<button className="btn" onClick={saveDraft} disabled={busy || !form.title.trim() || !form.body.trim() || (!form.allOrg && form.unitIds.length === 0 && form.roles.length === 0)}>{busy ? "Saving..." : form.id ? "Save changes" : "Save draft"}</button>}
    >
      {me.is_admin && error && <ProductNotice tone="error" title="Announcement draft not saved">{error}</ProductNotice>}
      <label className="label" htmlFor="announcement-title">Title *</label>
      <div className="assistive-inline">
        <input id="announcement-title" className="field" placeholder="e.g. Sunday Service Update" value={form.title} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, title: value })); }} />
        <VoiceInput compact label="Speak announcement title" onResult={(text) => setForm((current) => ({ ...current, title: current.title ? current.title + " " + text : text }))} />
      </div>

      <div className="reference-audience">
        <span className="label">Audience *</span>
        <div className="reference-audience-pills">
          <button type="button" className={form.audienceMode === "everyone" ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, audienceMode: "everyone", allOrg: true, unitIds: [], roles: [] }))}>Everyone</button>
          <button type="button" className={form.audienceMode === "departments" ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, audienceMode: "departments", allOrg: false, roles: [] }))}>Select departments</button>
          <button type="button" className={form.audienceMode === "roles" ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, audienceMode: "roles", allOrg: false, unitIds: [] }))}>Select roles</button>
        </div>
        {form.audienceMode === "departments" && <div className="reference-audience-options">
          {units.map((unit) => <label className="reference-chip-check" key={unit.id}><input type="checkbox" checked={form.unitIds.includes(unit.id)} onChange={() => toggleList("unitIds", unit.id)} /><span>{unit.name}</span></label>)}
        </div>}
        {form.audienceMode === "roles" && <div className="reference-audience-options">
          {ROLE_OPTIONS.map(([role, label]) => <label className="reference-chip-check" key={role}><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleList("roles", role)} /><span>{label}</span></label>)}
        </div>}
      </div>

      <label className="label" htmlFor="announcement-body">Message *</label>
      <div className="reference-message-box">
        <textarea id="announcement-body" className="field" rows={7} placeholder="Write your announcement…" value={form.body} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, body: value })); }} />
        <VoiceInput compact label="Speak announcement message" onResult={(text) => setForm((current) => ({ ...current, body: current.body ? current.body + " " + text : text }))} />
      </div>

      <details className="reference-disclosure">
        <summary><span>Attachments</span><span>+ Add file · {(form.files || []).length}</span></summary>
        <div className="reference-disclosure-body">
          <PendingFilePicker files={form.files || []} onChange={(files) => setForm((current) => ({ ...current, files }))} label="Attach files" disabled={busy} />
        </div>
      </details>

      <FieldGroup label="Available until (optional)">
        <input id="announcement-expiry" className="field" type="datetime-local" value={form.expiresAt} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, expiresAt: value })); }} />
        <span className="field-hint">The announcement remains a draft until it is explicitly published.</span>
      </FieldGroup>

      <details className="reference-disclosure">
        <summary><span>More options</span><span>+</span></summary>
        <div className="reference-disclosure-body">
          <FieldGroup label="Priority">
            <select id="announcement-priority" className="field" value={form.priority} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, priority: value })); }}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </FieldGroup>
          <label className="reference-check"><input type="checkbox" checked={form.requiresAck} onChange={(event) => { const checked = event.target.checked; setForm((current) => ({ ...current, requiresAck: checked })); }} /><span>Require acknowledgement</span></label>
        </div>
      </details>
    </ComposerDrawer>}
  </div>;
}
