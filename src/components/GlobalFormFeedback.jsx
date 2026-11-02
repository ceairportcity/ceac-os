import { useEffect, useRef, useState } from "react";

// Shared fallback for HTML required fields throughout CEAC.
// Individual workspaces retain responsibility for business-rule validation.
export default function GlobalFormFeedback() {
  const [message,setMessage] = useState("");
  const lastAt=useRef(0);
  useEffect(()=>{
    function invalid(event) {
      const field=event.target;
      if(!(field instanceof HTMLElement))return;
      const now=Date.now();
      if(now-lastAt.current<700)return;
      lastAt.current=now;
      const name=String(field.getAttribute("aria-label") || field.labels?.[0]?.textContent || field.getAttribute("placeholder") || "this field")
        .replace(/\s+/g," ").trim().slice(0,70);
      const readable=name || "this field";
      setMessage(field.validity?.typeMismatch ? `Check the format of ${readable}.` : `Complete ${readable} before continuing.`);
      requestAnimationFrame(()=>{
        field.scrollIntoView({block:"center",behavior:"smooth"});
        field.focus({preventScroll:true});
      });
    }
    document.addEventListener("invalid",invalid,true);
    return()=>document.removeEventListener("invalid",invalid,true);
  },[]);
  if(!message)return null;
  return <div className="ceac-form-feedback" role="alert" aria-live="assertive" style={{position:"fixed",top:"calc(10px + env(safe-area-inset-top))",right:12,left:12,zIndex:9999,maxWidth:460,margin:"0 auto",padding:"12px 16px",background:"#fff5f4",color:"#7c241e",border:"1px solid #d9a6a0",borderRadius:10,boxShadow:"0 8px 24px #15293d26"}}>
    <strong>One detail needs attention</strong>
    <p>{message}</p>
    <button type="button" onClick={()=>setMessage("")} aria-label="Dismiss form guidance">Close</button>
  </div>;
}
