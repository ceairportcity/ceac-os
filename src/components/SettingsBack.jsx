import "./SettingsBack.css";

// Only settings destinations own this return action. People, Finance, attendance,
// payroll and other independent workspaces never inherit a Control Center trail.
const SETTINGS_PAGES = new Set(["units", "authority", "policies", "integrations", "audit", "events", "workflows"]);
export default function SettingsBack({tab, enabled, go, returnTo, children}) {
  if (!enabled || !SETTINGS_PAGES.has(tab)) return children;
  return <div className="settings-detail-page">
    <button type="button" className="settings-back" onClick={() => go(returnTo === "people" ? "people" : "settings")} aria-label={returnTo === "people" ? "Back to People & Access" : "Back to Control Center"}>← Back</button>
    {children}
  </div>;
}
