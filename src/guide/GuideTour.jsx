import { useEffect } from "react";
import { Button } from "../experience-v2/components";
import "./guide.css";

export default function GuideTour({ tour, step, onStep, onPause, onFinish }) {
  const current = tour.steps[step];
  useEffect(() => {
    if (!current.target) return;
    let highlighted;
    const highlight = () => {
      const target = [...document.querySelectorAll(`[data-guide="${current.target}"]`)].find((node) => node.getClientRects().length);
      if (highlighted === target) return;
      highlighted?.classList.remove("ceac-tour-highlight");
      highlighted = target;
      highlighted?.classList.add("ceac-tour-highlight");
      highlighted?.scrollIntoView({ block:"nearest" });
    };
    highlight();
    const observer = new MutationObserver(highlight);
    const workspace = document.querySelector("main");
    if (workspace) observer.observe(workspace, { childList:true, subtree:true });
    return () => { observer.disconnect(); highlighted?.classList.remove("ceac-tour-highlight"); };
  }, [current]);
  return <aside className="ceac-tour" aria-label={tour.title}>
    <div aria-live="polite">
      <p className="ceac-tour-progress">{tour.title} · {step + 1} of {tour.steps.length}</p>
      <h2>{current.title}</h2>
      <p>{current.text}</p>
    </div>
    <div className="ceac-tour-actions">
      <Button size="sm" variant="quiet" onClick={onPause}>Pause</Button>
      {step > 0 && <Button size="sm" variant="secondary" onClick={() => onStep(step - 1)}>Back</Button>}
      <Button size="sm" onClick={step + 1 === tour.steps.length ? onFinish : () => onStep(step + 1)}>{step + 1 === tour.steps.length ? "Finish tour" : "Next"}</Button>
    </div>
  </aside>;
}
