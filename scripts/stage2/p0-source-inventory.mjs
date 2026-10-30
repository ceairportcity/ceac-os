/** Read-only CEAC Stage 2 P0 source inventory. Run: node scripts/stage2/p0-source-inventory.mjs
 * SOURCE evidence only. Client UI is never server RLS, RPC or Storage authorisation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT_COMPONENTS = Object.freeze({
  "guide": [
    "Guide"
  ],
  "account": [
    "AccountActivity"
  ],
  "achievements": [
    "PersonalAchievements"
  ],
  "technical-help": [
    "TechnicalHelp"
  ],
  "technical-support": [
    "TechnicalSupport"
  ],
  "primitives": [
    "DesignPrimitives"
  ],
  "home": [
    "Home",
    "ManagerHome",
    "AdminHome",
    "ExecutiveHome"
  ],
  "team": [
    "Team",
    "StaffTeam"
  ],
  "work": [
    "Work",
    "ManagerWork",
    "AdminWork",
    "ExecutiveWork"
  ],
  "staff-calendar": [
    "StaffCalendar"
  ],
  "messages": [
    "Inbox"
  ],
  "projects": [
    "ManagerProjects"
  ],
  "calendar": [
    "ManagerCalendar"
  ],
  "manager-finance": [
    "ManagerFinance"
  ],
  "manager-reports": [
    "ManagerReports"
  ],
  "exec-projects": [
    "AdminProjects"
  ],
  "exec-organisation": [
    "ExecutiveOrganisation"
  ],
  "exec-finance": [
    "ExecutiveFinance"
  ],
  "exec-reports": [
    "ExecutiveReports"
  ],
  "record": [
    "Record"
  ],
  "announcements": [
    "Announcements"
  ],
  "strategy": [
    "Strategy"
  ],
  "delivery": [
    "Delivery"
  ],
  "workload": [
    "ResourceWorkload"
  ],
  "performance": [
    "Performance"
  ],
  "learning": [
    "Learning"
  ],
  "assets": [
    "Assets"
  ],
  "compliance": [
    "Compliance"
  ],
  "cost": [
    "Cost"
  ],
  "finance": [
    "Finance"
  ],
  "reporting": [
    "Reports"
  ],
  "attendance": [
    "Workforce"
  ],
  "people": [
    "People"
  ],
  "lifecycle": [
    "AdminLifecycle"
  ],
  "protected-hr": [
    "AdminProtectedHR"
  ],
  "payroll": [
    "AdminPayroll"
  ],
  "units": [
    "Units"
  ],
  "admin-projects": [
    "AdminProjects"
  ],
  "admin-calendar": [
    "AdminCalendar"
  ],
  "exec-calendar": [
    "AdminCalendar"
  ],
  "audit": [
    "AdminAudit"
  ],
  "events": [
    "AdminEvents"
  ],
  "workflows": [
    "AdminWorkflows"
  ],
  "policies": [
    "AdminPolicies"
  ],
  "integrations": [
    "AdminIntegrations"
  ],
  "authority": [
    "AdminAuthority"
  ],
  "settings": [
    "ControlCenter"
  ],
  "office-settings": [
    "OfficeSettings"
  ]
});
const OVERLAY_ORDER = Object.freeze([
  ["item", "itemId ? <Item"], ["assign", ": assigning ? <Assign"],
  ["manager-project", ": projectId && isUnitManager ? <ManagerProjects"],
  ["personal-goal", ": goalId ? <Goals"], ["manager-person", ": person && isManager ? <PersonDetail"],
  ["room", ": roomContext ? <Room"], ["meeting-draft", ": meetingDraft ? <MeetingScheduler"],
  ["meeting", ": meetingId ? <Meeting"], ["fallback", ": pageForTab()"],
]);

export function collectP0SourceInventory(root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const app = read("src/App.jsx");
  const nav = read("src/experience-v2/shell/navigation.js");
  const begin = app.indexOf("function pageForTab() {");
  const end = app.indexOf("const appModeClass", begin);
  if (begin < 0 || end <= begin) throw new Error("P0 root router moved");
  const page = app.slice(begin, end);
  const branches = [...page.matchAll(/if\s*\(tab === "([^"]+)"(?:\s*&&\s*([^)]+))?\)/g)];
  const tabs = branches.map((b) => b[1]);
  if (tabs.length !== 48 || new Set(tabs).size !== 48
      || tabs.slice().sort().join("|") !== Object.keys(ROOT_COMPONENTS).sort().join("|")) {
    throw new Error("P0 root tab inventory changed; audit new or removed routes");
  }
  const imports = new Map([...app.matchAll(
    /const ([A-Z][A-Za-z0-9]*) = lazy\(\(\) => import\("\.\/screens\/([^"]+)"\)\);/g,
  )].map((m) => [m[1], m[2]]));
  const navScope = nav.split("const ROLE_DESTINATIONS = Object.freeze({")[1]
    ?.split("const MOBILE_PRIMARY_KEYS")[0];
  if (!navScope) throw new Error("P0 role navigation source is missing");
  const roleKeys = {};
  for (const r of navScope.matchAll(
    /(?:^|\n)\s*(staff|manager|admin|executive): Object\.freeze\(\[([\s\S]*?)\]\),/g,
  )) roleKeys[r[1]] = [...r[2].matchAll(/key: "([^"]+)"/g)].map((k) => k[1]);
  if (Object.keys(roleKeys).length !== 4) throw new Error("P0 role shells are missing");
  for (const [role, keys] of Object.entries(roleKeys)) {
    for (const key of keys) if (key !== "me" && !tabs.includes(key)) {
      throw new Error("P0 orphan " + role + " navigation route: " + key);
    }
  }
  const routes = branches.map((b, i) => {
    const tab = b[1];
    const chunk = page.slice(b.index, branches[i + 1]?.index || page.length);
    const components = ROOT_COMPONENTS[tab].map((component) => {
      const screen = imports.get(component);
      if (!screen || !chunk.includes("<" + component)) {
        throw new Error("P0 root route screen changed: " + tab + " / " + component);
      }
      const path = "src/screens/" + screen + ".jsx";
      const text = read(path);
      return {
        component, path,
        directTables: [...new Set([...text.matchAll(/\.from\(\s*["']([^"']+)["']/g)].map((v) => v[1]))].sort(),
        directRpcs: [...new Set([...text.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)].map((v) => v[1]))].sort(),
        directWriteCall: /\.(?:insert|update|delete|upsert)\(/.test(text),
      };
    });
    return {
      tab, rootGuard: b[2] || null, components,
      shellRoles: Object.entries(roleKeys).filter(([, keys]) => keys.includes(tab)).map(([role]) => role),
      proof: "SOURCE_ONLY; server RLS/RPC/Storage and role browser negatives are separate",
    };
  });
  // Overlay sources are separate from the root tabs: audit each mounted editor/screen.
  const OVERLAY_COMPONENT = Object.freeze({
    item: "Item", assign: "Assign", "manager-project": "ManagerProjects",
    "personal-goal": "Goals", "manager-person": "PersonDetail",
    room: "Room", "meeting-draft": "MeetingScheduler", meeting: "Meeting",
  });
  const allLazyImports = new Map([...app.matchAll(
    /const ([A-Z][A-Za-z0-9]*) = lazy\(\(\) => import\("(\.\/(?:screens|components)\/[^"]+)"\)\);/g,
  )].map((entry) => [entry[1], entry[2]]));
  const overlays = OVERLAY_ORDER.map(([name, marker]) => {
    const offset = app.indexOf(marker);
    if (name === "fallback") return { name, marker, offset, sourceEvidence: "root route fallback" };
    const component = OVERLAY_COMPONENT[name];
    const module = allLazyImports.get(component);
    if (!module || !app.includes("<" + component)) {
      throw new Error("P0 nested overlay source changed: " + name + " / " + component);
    }
    const path = "src/" + module.slice(2) + ".jsx";
    const source = read(path);
    return {
      name, marker, offset, component, path,
      directTables: [...new Set([...source.matchAll(/\.from\(\s*["']([^"']+)["']/g)].map((v) => v[1]))].sort(),
      directRpcs: [...new Set([...source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)].map((v) => v[1]))].sort(),
      directWriteCall: /\.(?:insert|update|delete|upsert)\(/.test(source),
      proof: "SOURCE_ONLY; overlay parameters never grant read/write authority",
    };
  });
  if (overlays.some((v) => v.offset < 0)
      || overlays.some((v, i) => i > 0 && v.offset <= overlays[i - 1].offset)) {
    throw new Error("P0 overlay order or fallback changed");
  }
  for (const key of ["tab", "item", "project", "meeting", "roomKind", "room"]) {
    if (!app.includes('params.get("' + key + '")')) throw new Error("P0 missing URL field " + key);
  }
  return {
    status: "SOURCE_INVENTORY_ONLY", routeCount: routes.length,
    roleNavigationCounts: Object.fromEntries(Object.entries(roleKeys).map(([role, keys]) => [role, keys.length])),
    routes, overlays,
    limitations: [
      "Child components can contain more RPCs and writes",
      "Client guards do not prove protected server authorization",
      "No V4 design, Codespace diff or stage acceptance is inferred",
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(JSON.stringify(collectP0SourceInventory(), null, 2) + "\n");
}
