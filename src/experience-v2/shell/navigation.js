const GROUP_LABELS = Object.freeze({
  workspace: "Workspace",
  planning: "Planning",
  insight: "Insight",
  communication: "Communication",
  system: "System",
  account: "Account",
});

const ROLE_DESTINATIONS = Object.freeze({
  staff: Object.freeze([
    { key: "home", label: "Today", icon: "home", group: "workspace" },
    { key: "work", label: "Work", icon: "work", group: "workspace" },
    { key: "team", label: "Team", icon: "team", group: "workspace" },
    { key: "attendance", label: "Time & Leave", icon: "time", group: "planning" },
    { key: "staff-calendar", label: "Calendar", icon: "calendar", group: "planning" },
    { key: "messages", label: "Messages", icon: "messages", group: "communication" },
    { key: "me", label: "My Hub", icon: "account", group: "account" },
    { key: "account", label: "Your account", icon: "account", group: "account" },
  ]),
  manager: Object.freeze([
    { key: "home", label: "Overview", icon: "home", group: "workspace" },
    { key: "work", label: "Work", icon: "work", group: "workspace" },
    { key: "team", label: "Team", icon: "team", group: "workspace" },
    { key: "projects", label: "Projects", icon: "projects", group: "workspace" },
    { key: "attendance", label: "Time & Leave", icon: "time", group: "planning" },
    { key: "calendar", label: "Calendar", icon: "calendar", group: "planning" },
    { key: "manager-finance", label: "Finance", icon: "finance", group: "insight" },
    { key: "manager-reports", label: "Reports", icon: "reports", group: "insight" },
    { key: "messages", label: "Messages", icon: "messages", group: "communication" },
    { key: "me", label: "My Hub", icon: "account", group: "account" },
    { key: "account", label: "Your account", icon: "account", group: "account" },
  ]),
  admin: Object.freeze([
    { key: "home", label: "Overview", icon: "home", group: "workspace" },
    { key: "people", label: "People & Access", icon: "people", group: "workspace", capability: "people.manage" },
    { key: "work", label: "Work", icon: "work", group: "workspace" },
    { key: "attendance", label: "Time & Leave", icon: "time", group: "planning" },
    { key: "admin-calendar", label: "Calendar", icon: "calendar", group: "planning" },
    { key: "finance", label: "Finance", icon: "finance", group: "insight" },
    { key: "payroll", label: "Payroll", icon: "budget", group: "insight", capability: "payroll.prepare" },
    { key: "reporting", label: "Reports", icon: "reports", group: "insight" },
    { key: "settings", label: "Control Center", icon: "control", group: "system" },
    { key: "messages", label: "Messages", icon: "messages", group: "communication" },
    { key: "me", label: "My Hub", icon: "person", group: "account" },
    { key: "account", label: "Your account", icon: "account", group: "account" },
  ]),
  executive: Object.freeze([
    { key: "home", label: "Overview", icon: "home", group: "workspace" },
    { key: "work", label: "Work", icon: "work", group: "workspace" },
    { key: "strategy", label: "Ministry", icon: "ministry", group: "workspace" },
    { key: "delivery", label: "Portfolio", icon: "portfolio", group: "workspace" },
    { key: "exec-organisation", label: "Organisation", icon: "organisation", group: "workspace" },
    { key: "exec-calendar", label: "Calendar", icon: "calendar", group: "planning" },
    { key: "exec-finance", label: "Finance", icon: "finance", group: "insight" },
    { key: "payroll", label: "Payroll", icon: "finance", group: "insight", capability: "payroll.approve" },
    { key: "exec-reports", label: "Reports", icon: "reports", group: "insight" },
    { key: "messages", label: "Messages", icon: "messages", group: "communication" },
    { key: "me", label: "My Hub", icon: "account", group: "account" },
    { key: "account", label: "Account", icon: "account", group: "account" },
  ]),
});

const MOBILE_PRIMARY_KEYS = Object.freeze({
  staff: Object.freeze(["home", "work", "team", "me"]),
  manager: Object.freeze(["home", "work", "team", "projects"]),
  admin: Object.freeze(["home", "people", "attendance", "finance"]),
  // Owner-approved mobile dock is Overview / Work / Ministry / More.
  // Calendar stays available in the More drawer, never as a fifth item.
  executive: Object.freeze(["home", "work", "strategy"]),
});

const ROLE_QUICK_ACTIONS = Object.freeze({
  staff: Object.freeze([
    { id: "announcement", label: "Announcement", icon: "messages", action: "announcement" },
    { id: "meeting", label: "Meeting", icon: "meeting", action: "meeting" },
    { id: "message", label: "Message room", icon: "messages", action: "message" },
  ]),
  manager: Object.freeze([
    { id: "work", label: "New work", icon: "work", action: "work" },
    { id: "announcement", label: "Announcement", icon: "messages", action: "announcement" },
    { id: "meeting", label: "Meeting", icon: "meeting", action: "meeting" },
    { id: "message", label: "Message room", icon: "messages", action: "message" },
  ]),
  admin: Object.freeze([
    { id: "work", label: "New work", icon: "work", action: "work" },
    { id: "announcement", label: "Announcement", icon: "notification", action: "announcement" },
    { id: "meeting", label: "Meeting", icon: "meeting", action: "meeting" },
    { id: "message", label: "Message room", icon: "messages", action: "message" },
  ]),
  executive: Object.freeze([
    { id: "work", label: "Give out work", icon: "work", action: "work" },
    { id: "ministry-objective", label: "Ministry objective", icon: "ministry", action: "ministry" },
    { id: "project", label: "Project", icon: "projects", action: "project" },
    { id: "announcement", label: "Announcement", icon: "messages", action: "announcement" },
    { id: "meeting", label: "Meeting", icon: "meeting", action: "meeting" },
    { id: "message", label: "Message room", icon: "messages", action: "message" },
  ]),
});

export function getRoleKey({ isAdmin = false, isExec = false, isManager = false } = {}) {
  if (isExec) return "executive";
  if (isAdmin) return "admin";
  if (isManager) return "manager";
  return "staff";
}

export function hasMultipleUnits(me, { isAdmin = false, isExec = false } = {}) {
  return !isAdmin && !isExec && (me?.memberships?.length || 0) > 1;
}

export function getRoleName(context = {}) {
  const role = getRoleKey(context);
  if (role === "executive") return "Group Pastor / CEO";
  if (role === "admin") return "Administration & HR";
  if (role === "manager") return "Manager";
  return "Staff";
}


// Administration module links follow the same organisation-wide grants as App.
// A unit-scoped grant never creates an organisation administration entry point.
export function getAdministrationTools(me = {}) {
  const grants = me.capability_grants || [];
  return [
    { key: "performance", label: "Reviews & Development", icon: "goal", group: "insight", capability: "performance.admin", searchTerms: "performance appraisal quarterly reviews" },
    { key: "learning", label: "Learning", icon: "learning", group: "insight", capability: "learning.manage", searchTerms: "courses training" },
  ].filter(item => grants.some(grant => grant.capability === item.capability && !grant.scope_unit_id));
}

export function getShellNavigation({ me, ...context } = {}) {
  const role = getRoleKey(context);
  const capabilities = new Set(me?.capabilities || []);

  // Every signed-in person can report a support problem. Technical Support
  // is separate from employment roles and never implies administrative power.
  const destinations = [...ROLE_DESTINATIONS[role],
    { key: "technical-help", label: "Get technical help", icon: "help", group: "account" },
  ];
  if (role === "admin") {
    const index = destinations.findIndex(item => item.key === "settings");
    destinations.splice(index, 0, ...getAdministrationTools(me));
  }
  // Compliance is an independent department workspace, not an HR tool.
  // A department name/title or a flat/unit-scoped capability is not authority.
  // Use the existing organisation grant; do not grant HR or other powers here.
  if (role !== "admin" && role !== "executive" &&
      (me?.capability_grants || []).some(grant => grant.capability === "compliance.manage" && !grant.scope_unit_id)) {
    destinations.push({
      key: "compliance", label: "Compliance", icon: "compliance", group: "workspace",
      searchTerms: "policies evidence observations exceptions",
    });
  }
  if (capabilities.has("support.case.manage")) {
    destinations.push({
      key: "technical-support", label: "Technical Support",
      icon: "help", group: "system", capability: "support.case.manage",
    });
  }
  return destinations.filter(
    (item) => !item.capability || capabilities.has(item.capability) || (role === "admin" && getAdministrationTools(me).some(tool => tool.key === item.key))
  );
}

export function getMobilePrimaryNavigation(context = {}) {
  const role = getRoleKey(context);
  const navigation = getShellNavigation(context);
  const keys = MOBILE_PRIMARY_KEYS[role];

  return keys
    .map((key) => navigation.find((item) => item.key === key))
    .filter(Boolean);
}

export function getSecondaryNavigation(context = {}) {
  const navigation = getShellNavigation(context);
  const primaryKeys = new Set(
    getMobilePrimaryNavigation(context).map((item) => item.key)
  );
  return navigation.filter((item) => !primaryKeys.has(item.key));
}

export function getShellQuickActions(context = {}, handlers = {}) {
  const role = getRoleKey(context);
  const actionHandlers = {
    work: handlers.onCreateWork,
    ministry: handlers.onCreateMinistryObjective,
    project: handlers.onCreateProject,
    announcement: handlers.onCreateAnnouncement,
    meeting: handlers.onCreateMeeting,
    message: handlers.onComposeMessage || handlers.onMessages,
  };

  return ROLE_QUICK_ACTIONS[role]
    .map((item) => ({ ...item, onSelect: actionHandlers[item.action] }))
    .filter((item) => typeof item.onSelect === "function");
}

export function groupDestinations(items = []) {
  const groups = [];
  for (const item of items) {
    const key = item.group || "workspace";
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label: GROUP_LABELS[key] || "More", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
