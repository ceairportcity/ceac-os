import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Sheet } from "../components/bits";
import { ComposerDrawer } from "../experience-v2/components";
import VoiceInput from "../components/VoiceInput";

const ROLE_OPTIONS = [
  ["staff", "Staff"], ["sub_team_lead", "Team leads"], ["manager", "Unit heads"],
  ["admin", "Administration"], ["exec", "Group Pastor"],
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

function blankForm() {
  return { id: null, title: "", body: "", priority: "normal", requiresAck: false, expiresAt: "", allOrg: true, unitIds: [], roles: [] };
}

export default function Announcements({ me, back, createRequest = false, onCreateHandled }) {
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [canPublish, setCanPublish] = useState(Boolean(me.is_admin || me.is_exec));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id]);
  useEffect(() => {
    if (createRequest && canPublish) {
      setForm(blankForm());
      onCreateHandled?.();
    }
  }, [createRequest, canPublish]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [announcementResult, capabilityResult, unitResult] = await Promise.all([
        supabase.from("announcements")
          .select("id,title,body,priority,status,requires_acknowledgement,published_at,expires_at,created_at,profiles!announcements_author_id_fkey(full_name),announcement_receipts(profile_id,read_at,acknowledged_at),announcement_audiences(id,audience_type,unit_id,audience_role,units(name))")
          .order("created_at", { ascending: false }),
        supabase.from("capabilities").select("id").eq("profile_id", me.id).eq("capability", "post_announcement").maybeSingle(),
        supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("position"),
      ]);
      if (announcementResult.error) throw new Error(`Announcements: ${announcementResult.error.message}`);
      if (capabilityResult.error) throw new Error(`Publishing permission: ${capabilityResult.error.message}`);
      if (unitResult.error) throw new Error(`Units: ${unitResult.error.message}`);
      const announcements = announcementResult.data || [];
      setCanPublish(Boolean(me.is_admin || me.is_exec || capabilityResult.data));
      setUnits(unitResult.data || []);
      if (me.is_admin || me.is_exec || capabilityResult.data) {
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
    setForm({
      id: announcement.id, title: announcement.title, body: announcement.body, priority: announcement.priority,
      requiresAck: announcement.requires_acknowledgement,
      expiresAt: announcement.expires_at ? new Date(announcement.expires_at).toISOString().slice(0, 16) : "",
      allOrg: audiences.some((audience) => audience.audience_type === "organisation"),
      unitIds: audiences.filter((audience) => audience.audience_type === "unit").map((audience) => audience.unit_id),
      roles: audiences.filter((audience) => audience.audience_type === "role").map((audience) => audience.audience_role),
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

  return <div className="body">
    <div style={{ paddingTop: 26 }}>
      {back && <button className="back" onClick={back}>← Back</button>}
      <div className="eyebrow">Organisation communication</div>
      <h1 className="h1" style={{ marginTop: 6 }}>Announcements</h1>
      <p className="screen-note">Important messages for the organisation, your role or your unit.</p>
      {canPublish && <button className="btn" style={{ marginTop: 14 }} onClick={() => setForm(blankForm())}>New announcement</button>}
    </div>

    {error && <div className="flag flag-brick" style={{ marginTop: 14 }}><h4>Could not complete that</h4>{error}<button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={load}>Try again</button></div>}
    {loading && <div className="spin">Loading announcements...</div>}
    {!loading && <div style={{ marginTop: 18 }}>
      {rows.length === 0 && <div className="card small">There are no current announcements for you.</div>}
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

    {selected && <Sheet onClose={() => setSelected(null)}>
      <div className="eyebrow">{selected.priority}{selected.status !== "published" ? ` · ${selected.status}` : ""}</div>
      <div className="h2" style={{ marginTop: 5 }}>{selected.title}</div>
      <div className="row-m">{selected.profiles?.full_name || "CEAC"} · {formatDate(selected.published_at || selected.created_at)}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 18 }}>{selected.body}</div>
      {selected.expires_at && <div className="hint">Available until {formatDate(selected.expires_at)}</div>}
      {selected.requires_acknowledgement && !receiptFor(selected)?.acknowledged_at && selected.status === "published" &&
        <button className="btn" style={{ marginTop: 18 }} onClick={acknowledge} disabled={busy}>{busy ? "Saving..." : "I acknowledge this message"}</button>}
      {receiptFor(selected)?.acknowledged_at && <div className="flag flag-green" style={{ marginTop: 18 }}><h4>Acknowledged</h4>{formatDate(receiptFor(selected).acknowledged_at)}</div>}
    </Sheet>}

    {form && <ComposerDrawer
      open
      onClose={() => !busy && setForm(null)}
      title={form.id ? "Edit announcement draft" : "New announcement"}
      description="Choose the audience, write the message and publish only after the draft is ready."
      footer={<button className="btn" onClick={saveDraft} disabled={busy || !form.title.trim() || !form.body.trim() || (!form.allOrg && form.unitIds.length === 0 && form.roles.length === 0)}>{busy ? "Saving..." : "Save draft"}</button>}
    >
      <label className="label" htmlFor="announcement-title">Title</label>
      <div className="assistive-field">
        <input id="announcement-title" className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <VoiceInput compact label="Speak announcement title" onResult={(text) => setForm((current) => ({ ...current, title: current.title ? current.title + " " + text : text }))} />
      </div>
      <label className="label" htmlFor="announcement-body">Message</label>
      <div className="assistive-field textarea">
        <textarea id="announcement-body" className="field" rows={7} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        <VoiceInput compact label="Speak announcement message" onResult={(text) => setForm((current) => ({ ...current, body: current.body ? current.body + " " + text : text }))} />
      </div>
      <label className="label" htmlFor="announcement-priority">Priority</label>
      <select id="announcement-priority" className="field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
        <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
      </select>
      <label className="label" htmlFor="announcement-expiry">Expiry (optional)</label>
      <input id="announcement-expiry" className="field" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
      <label className="opt"><input type="checkbox" checked={form.requiresAck} onChange={(event) => setForm({ ...form, requiresAck: event.target.checked })} /> Require acknowledgement</label>

      <div className="sec"><span>Audience</span></div>
      <label className="opt"><input type="checkbox" checked={form.allOrg} onChange={(event) => setForm({ ...form, allOrg: event.target.checked })} /> Entire organisation</label>
      {!form.allOrg && <>
        <div className="label">Units</div>
        {units.map((unit) => <label className="opt" key={unit.id}><input type="checkbox" checked={form.unitIds.includes(unit.id)} onChange={() => toggleList("unitIds", unit.id)} /> {unit.name}</label>)}
        <div className="label">Roles</div>
        {ROLE_OPTIONS.map(([role, label]) => <label className="opt" key={role}><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleList("roles", role)} /> {label}</label>)}
      </>}
    </ComposerDrawer>}
  </div>;
}
