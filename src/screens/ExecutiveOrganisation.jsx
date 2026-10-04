import { useEffect,useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState,ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { StatusBadge } from "../experience-v2/components";

export default function ExecutiveOrganisation({me}){
 const [units,setUnits]=useState([]),[people,setPeople]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null);
 useEffect(()=>{load();},[me.org_id]);

 async function load(){
  setLoading(true);setError(null);
  try{
   const [u,p]=await Promise.all([
    supabase.from("units").select("id,name,code,active").eq("org_id",me.org_id).order("name"),
    supabase.from("unit_memberships").select("unit_id,role,profiles(id,full_name,job_title,active)").eq("org_id",me.org_id)
   ]);
   if(u.error||p.error)throw u.error||p.error;
   setUnits(u.data||[]);
   setPeople(p.data||[]);
  }catch(e){setError(humanError(e,"Organisation could not be loaded."));}
  finally{setLoading(false);}
 }

 const rows=units.filter((unit)=>unit.active!==false).map((unit)=>{
  const members=people.filter((membership)=>membership.unit_id===unit.id&&membership.profiles?.active!==false);
  const leaders=members.filter((membership)=>membership.role==="manager").map((membership)=>membership.profiles?.full_name).filter(Boolean);
  return {unit,members,leaders};
 });
 const missingLeaders=rows.filter((row)=>row.leaders.length===0);

 return <div className="body premium-exec-page ev2-exec-organisation">
  <header className="exec-page-head">
   <div>
    <span className="eyebrow">Leadership view</span>
    <h1 className="h1">Organisation</h1>
    <p className="screen-note">Departments, recorded leaders and active people. Structural exceptions are shown first; Administration remains responsible for changes.</p>
   </div>
   <StatusBadge tone={missingLeaders.length?"warning":"success"} icon={false}>
    {missingLeaders.length?`${missingLeaders.length} leadership gap${missingLeaders.length===1?"":"s"}`:"Leadership recorded"}
   </StatusBadge>
  </header>

  {error&&<ProductNotice tone="error" title="Could not load Organisation">{error}</ProductNotice>}
  {loading?<LoadingState label="Loading organisation…"/>:<>
   {missingLeaders.length?<ProductNotice tone="attention" title="Needs attention">
    {missingLeaders.map((row)=>row.unit.name).join(", ")} {missingLeaders.length===1?"does":"do"} not have a recorded Unit Head.
   </ProductNotice>:null}
   <section className="exec-org-grid" aria-label="Departments and leadership">
    {rows.map(({unit,members,leaders})=><article key={unit.id}>
     <div className="exec-org-icon">{unit.name.slice(0,1)}</div>
     <div>
      <strong>{unit.name}</strong>
      <small>{leaders.join(", ")||"Leader not recorded"}</small>
     </div>
     <b>{members.length}<span> people</span></b>
    </article>)}
   </section>
  </>}
 </div>;
}
