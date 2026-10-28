import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
// RLS returns a link only to existing Memo participants. Project access itself
// never grants access to confidential proposal content or documents.
export default function MemoProjectOrigin({project}) {
  const scope=`${project.org_id}:${project.id}`;
  const [source,setSource]=useState(null);
  useEffect(()=>{
    let current=true;
    supabase.from("memos").select("id").eq("org_id",project.org_id).eq("project_id",project.id).maybeSingle()
      .then(result=>{if(current)setSource(result.error?null:{scope,id:result.data?.id});});
    return()=>{current=false;};
  },[scope]);
  return source?.scope===scope && source.id
    ? <p><a href={`/?tab=messages&memo=${encodeURIComponent(source.id)}`}>Open originating Memo</a></p>
    : null;
}
