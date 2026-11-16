import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, ProductNotice } from "./bits";

export default function ProjectPersonPicker({ orgId, value, onChange }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let current = true;
    supabase.from("profiles").select("id,full_name,job_title", { count: "exact" })
      .eq("org_id", orgId).eq("active", true).order("full_name").order("id")
      .then(result => {
        if (!current) return;
        if (result.error || !Array.isArray(result.data) || result.count !== result.data.length) {
          setError(true);
        } else {
          setPeople(result.data);
        }
      });
    return () => { current = false; };
  }, [orgId]);

  const selected = people?.some(person => person.id === value) ? value : "";
  return <>
    <FieldGroup label="Responsible person">
      <select className="field" required value={selected} onChange={event => onChange(event.target.value)}>
        <option value="">{error ? "People unavailable" : !people ? "Loading people…" : people.length ? "Choose a person" : "No active people available"}</option>
        {people?.map(person => <option key={person.id} value={person.id}>
          {person.job_title ? person.full_name + " · " + person.job_title : person.full_name}
        </option>)}
      </select>
    </FieldGroup>
    {error && <ProductNotice tone="error" title="People unavailable">Close this form and try again.</ProductNotice>}
  </>;
}
