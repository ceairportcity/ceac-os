import { useEffect, useState } from "react";
import { ceacLandscapeCatalog } from "../lib/ceacLandscapeCatalog";
import { ghanaCalendarDate, selectDailyLandscape } from "../lib/dailyLandscape";
import "./DailyScenicPhoto.css";

/** Real, licensed, locally hosted photographs. Changes on Ghana's calendar date. */
export default function DailyScenicPhoto() {
  const [today, setToday] = useState(() => ghanaCalendarDate());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Re-check for long-lived dashboard sessions without requiring a new login.
    const interval = setInterval(() => {
      const next = ghanaCalendarDate();
      if (next !== today) { setToday(next); setFailed(false); }
    }, 60_000);
    return () => clearInterval(interval);
  }, [today]);
  const photo = selectDailyLandscape(ceacLandscapeCatalog, today + "T12:00:00Z");
  return <div className="s2-scenic-photo" aria-hidden="true">
    {!failed && <img key={photo.src} src={photo.src} alt="" loading="eager" decoding="async"
      onError={() => setFailed(true)} />}
  </div>;
}
