import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { StatusBadge } from "../experience-v2/components";
import { CeacIcon } from "../experience-v2/icons";

export default function ExecutiveOrganisation({ me }) {
  const [units, setUnits] = useState([]);
  const [people, setPeople] = useState([]);
  const [teams, setTeams] = useState([]);
  const [view, setView] = useState("departments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.org_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [unitResult, peopleResult, teamResult] = await Promise.all([
        supabase.from("units").select("id,name,code,active").eq("org_id", me.org_id).order("name"),
        supabase.from("unit_memberships").select("unit_id,role,profiles(id,full_name,job_title,active)").eq("org_id", me.org_id),
        supabase.from("sub_teams").select("id,name,unit_id,active").eq("org_id", me.org_id).eq("active", true).order("name"),
      ]);
      const firstError = [unitResult.error, peopleResult.error, teamResult.error].find(Boolean);
      if (firstError) throw firstError;
      setUnits(unitResult.data || []);
      setPeople(peopleResult.data || []);
      setTeams(teamResult.data || []);
    } catch (loadError) {
      setError(humanError(loadError, "Organisation could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const unitName = (id) => units.find((unit) => unit.id === id)?.name || "Department";
  const rows = units.filter((unit) => unit.active !== false).map((unit) => {
    const members = people.filter((membership) => membership.unit_id === unit.id && membership.profiles?.active !== false);
    const leaders = members.filter((membership) => membership.role === "manager").map((membership) => membership.profiles?.full_name).filter(Boolean);
    return { unit, members, leaders };
  });
  const missingLeaders = rows.filter((row) => row.leaders.length === 0);
  const visiblePeople = useMemo(() => {
    const unique = new Map();
    people.forEach((membership) => {
      const person = membership.profiles;
      if (!person?.id || person.active === false) return;
      const current = unique.get(person.id) || { ...person, memberships: [] };
      current.memberships.push({ unit_id: membership.unit_id, role: membership.role });
      unique.set(person.id, current);
    });
    return Array.from(unique.values()).sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));
  }, [people]);

  return <div className="body ev2-exec-organisation exec-redesign-page">
    <header className="exec-redesign-head">
      <div>
        <span>Executive structure</span>
        <h1>Organisation</h1>
        <p>View departments, teams and people across the recorded CEAC structure. Structural exceptions are shown first for review; Administration remains responsible for structural changes.</p>
      </div>
      <StatusBadge tone={missingLeaders.length ? "warning" : "success"} icon={false}>
        {missingLeaders.length ? `${missingLeaders.length} leadership gap${missingLeaders.length === 1 ? "" : "s"}` : "Leadership recorded"}
      </StatusBadge>
    </header>

    <div className="exec-redesign-tabs" role="tablist" aria-label="Organisation views">
      {[
        ["departments", "Departments"],
        ["teams", "Teams"],
        ["people", "People"],
      ].map(([key, label]) => <button
        key={key}
        type="button"
        role="tab"
        aria-selected={view === key}
        className={view === key ? "is-active" : ""}
        onClick={() => setView(key)}
      >{label}</button>)}
    </div>

    {error && <ProductNotice tone="error" title="Could not load Organisation">{error}</ProductNotice>}
    {loading ? <LoadingState label="Loading organisation…" /> : <>
      {missingLeaders.length && view === "departments" ? <ProductNotice tone="attention" title="Needs attention">
        {missingLeaders.map((row) => row.unit.name).join(", ")} {missingLeaders.length === 1 ? "does" : "do"} not have a recorded Unit Head.
      </ProductNotice> : null}

      {view === "departments" ? <section className="exec-redesign-list" aria-label="Departments">
        {rows.map(({ unit, members, leaders }, index) => <article className="exec-redesign-list-row" key={unit.id}>
          <span className={`exec-redesign-icon is-${["purple","green","blue","amber"][index % 4]}`}><CeacIcon name="organisation" size="row" decorative /></span>
          <span className="exec-redesign-row-copy">
            <strong>{unit.name}</strong>
            <small>{leaders.join(", ") || "Leader not recorded"}</small>
          </span>
          <span className="exec-redesign-row-meta">{members.length} member{members.length === 1 ? "" : "s"}</span>
          <span aria-hidden="true">›</span>
        </article>)}
      </section> : null}

      {view === "teams" ? <section className="exec-redesign-list" aria-label="Teams">
        {teams.length ? teams.map((team, index) => <article className="exec-redesign-list-row" key={team.id}>
          <span className={`exec-redesign-icon is-${["green","blue","amber","purple"][index % 4]}`}><CeacIcon name="team" size="row" decorative /></span>
          <span className="exec-redesign-row-copy">
            <strong>{team.name}</strong>
            <small>{unitName(team.unit_id)}</small>
          </span>
          <span className="exec-redesign-row-meta">Team</span>
          <span aria-hidden="true">›</span>
        </article>) : <div className="exec-redesign-empty">No active teams are recorded.</div>}
      </section> : null}

      {view === "people" ? <section className="exec-redesign-list" aria-label="People">
        {visiblePeople.length ? visiblePeople.map((person, index) => <article className="exec-redesign-list-row" key={person.id}>
          <span className={`exec-redesign-icon is-${["blue","purple","green","amber"][index % 4]}`}><CeacIcon name="account" size="row" decorative /></span>
          <span className="exec-redesign-row-copy">
            <strong>{person.full_name || "Recorded person"}</strong>
            <small>{person.job_title || person.memberships.map((item) => unitName(item.unit_id)).join(", ") || "Role not recorded"}</small>
          </span>
          <span className="exec-redesign-row-meta">{person.memberships.length} placement{person.memberships.length === 1 ? "" : "s"}</span>
          <span aria-hidden="true">›</span>
        </article>) : <div className="exec-redesign-empty">No active people are visible.</div>}
      </section> : null}
    </>}
  </div>;
}
