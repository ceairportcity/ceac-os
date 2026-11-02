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
  return <div className="ceac-form-feedback" role="alert" aria-live="assertive">
    <strong>One detail needs attention</strong>
    <p>{message}</p>
    <button type="button" onClick={()=>setMessage("")} aria-label="Dismiss form guidance">Close</button>
  </div>;
}
