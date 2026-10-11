import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { HELP_CATEGORIES, supportCategoryLabel } from "../lib/technicalSupport";
import "../role-styles/technical-support.css";

const formatDate = (date) => date ? new Date(date).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric",
}) : "Unknown date";

export default function TechnicalHelp({ me }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(HELP_CATEGORIES[0].id);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [service, setService] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error: failure } = await supabase.from("support_cases")
        .select("id,reference,category,summary,state,opened_at")
        .eq("reported_by", me.id).eq("org_id", me.org_id)
        .order("opened_at", { ascending: false }).limit(30);
      if (!live) return;
      setCases(failure ? [] : (data || []));
      setLoadError(failure ? "The Help Desk is not connected to a verified support service yet. No existing requests can be displayed." : null);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [me.id, me.org_id]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const title = summary.trim();
    const details = description.trim();
    if (title.length < 8 || details.length < 12) {
      setError("Add a short summary and explain what is happening before sending.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: failure } = await supabase.from("support_cases").insert({
        org_id: me.org_id, reported_by: me.id, affected_profile_id: me.id,
        category, summary: title, description: details,
        affected_service: service.trim() || null, impact: "normal", state: "open",
      }).select("id,reference,category,summary,state,opened_at").single();
      if (failure) throw failure;
      setCases((previous) => [data, ...previous]);
      setSummary(""); setDescription(""); setService("");
      setSuccess("Your request was recorded. Reference: " + data.reference);
      setLoadError(null);
    } catch (failure) {
      setError(humanError(failure, "Your request could not be recorded. Nothing was submitted. Please use the current approved CEAC support contact."));
    } finally {
      setBusy(false);
    }
  }

  return <main className="body ceac-support-page">
    <header className="ceac-support-heading">
      <p className="ceac-support-eyebrow">CEAC assistance</p>
      <h1>Get technical help</h1>
      <p>Tell Technical Support what is preventing you from working. Do not include passwords, verification codes, financial records or confidential employee information.</p>
    </header>
    <div className="ceac-support-layout">
      <section className="ceac-support-main" aria-labelledby="support-new-request">
        <h2 id="support-new-request">Describe the problem</h2>
        <form className="ceac-support-form" onSubmit={submit}>
          <label>What do you need help with?
            <select value={category} onChange={(event) => setCategory(event.target.value)} required>
              {HELP_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Short summary
            <input value={summary} onChange={(event) => setSummary(event.target.value)}
              maxLength={160} minLength={8} placeholder="What is preventing you from working?" required />
          </label>
          <label>What happened?
            <textarea value={description} onChange={(event) => setDescription(event.target.value)}
              maxLength={3000} minLength={12} rows={5}
              placeholder="Describe the steps and the error you saw. Leave out confidential content." required />
          </label>
          <label>Affected CEAC feature (optional)
            <input value={service} onChange={(event) => setService(event.target.value)}
              maxLength={120} placeholder="For example, invitations or file uploads" />
          </label>
          {error && <p className="ceac-support-error" role="alert">{error}</p>}
          {success && <p className="ceac-support-success" role="status">{success}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? "Recording request..." : "Send help request"}</button>
        </form>
      </section>
      <aside className="ceac-support-side" aria-labelledby="support-my-requests">
        <h2 id="support-my-requests">Your requests</h2>
        {loading && <p role="status">Loading your requests...</p>}
        {loadError && <p className="ceac-support-error" role="status">{loadError}</p>}
        {!loading && !loadError && cases.length === 0 && <p className="screen-note">No requests have been recorded.</p>}
        <div className="ceac-support-rows">
          {cases.map((item) => <article key={item.id} className="ceac-support-row">
            <div><strong>{item.summary}</strong><span>{item.reference || "Reference pending"} · {supportCategoryLabel(item.category)}</span></div>
            <small>{item.state.replaceAll("_", " ")} · {formatDate(item.opened_at)}</small>
          </article>)}
        </div>
      </aside>
    </div>
  </main>;
}
