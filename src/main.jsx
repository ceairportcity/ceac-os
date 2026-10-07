import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ExperienceV2MotionProvider from "./experience-v2/ExperienceV2MotionProvider";
import "./styles.css";
import "./premium.css";
import "./premium-staff.css";
import "./premium-manager.css";
import "./premium-admin.css";
import "./premium-executive.css";
import "./premium-parity.css";
import "./experience-v2.css";
import "./experience-v2/components/components.css";
import "./experience-v2/shell/shell.css";
import "./experience-v2/staff-today/staff-today.css";
import "./experience-v2/admin-overview/admin-overview.css";
import "./experience-v2/work-family/work-family.css";
import "./experience-v2/executive-overview/executive-surfaces.css";
import "./experience-v2/project-family/project-family.css";
import "./experience-v2/people-family/people-family.css";
import "./experience-v2/workforce-family/workforce-family.css";
import "./experience-v2/finance-family/finance-family.css";
import "./experience-v2/personal-family/personal-family.css";
import "./experience-v2/calendar/calendar.css";
import "./experience-v2/data-viz/data-viz.css";
import "./experience-v2/integrations/integrations.css";
import "./resilience/pwa-status.css";

const PwaStatus = lazy(() => import("./resilience/PwaStatus"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ExperienceV2MotionProvider>
      <App />
      <Suspense fallback={null}>
        <PwaStatus />
      </Suspense>
    </ExperienceV2MotionProvider>
  </React.StrictMode>
);

if (import.meta.env.PROD) {
  import("./resilience/registerServiceWorker").then(({ registerCeacServiceWorker }) => {
    registerCeacServiceWorker();
  });
}
