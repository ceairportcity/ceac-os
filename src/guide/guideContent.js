export const CEAC_GUIDE_VERSION = "2026.10.23";

export const CEAC_GUIDE_ROUTE_LABELS = Object.freeze({
  home: "Home",
  work: "Work",
  team: "Team",
  projects: "Projects",
  attendance: "Time & Leave",
  "staff-calendar": "Calendar",
  calendar: "Calendar",
  "admin-calendar": "Calendar",
  "exec-calendar": "Calendar",
  messages: "Messages",
  announcements: "Announcements",
  me: "My Hub",
  account: "Your account",
  people: "People & Access",
  settings: "Control Center",
  finance: "Finance",
  "manager-finance": "Finance",
  "exec-finance": "Finance",
  payroll: "Payroll",
  reporting: "Reports",
  "manager-reports": "Reports",
  "exec-reports": "Reports",
  strategy: "Ministry",
  delivery: "Portfolio",
  "exec-organisation": "Organisation",
  performance: "Performance & development",
  learning: "Learning",
  compliance: "Compliance",
});

const ALL = Object.freeze(["staff", "manager", "admin", "executive"]);


export const CEAC_GUIDE_GETTING_STARTED = Object.freeze({
  staff: Object.freeze([
    { id: "home", label: "Open Today and identify what needs attention", route: "home" },
    { id: "work", label: "Open Work and review an assignment or request", route: "work" },
    { id: "leave", label: "Review Time & Leave and your annual-leave context", route: "attendance" },
    { id: "calendar", label: "Open Calendar and check your working week", route: "staff-calendar" },
    { id: "messages", label: "Open Messages and understand your operational rooms", route: "messages" },
    { id: "me", label: "Open My Hub and review your personal CEAC information", route: "me" },
  ]),
  manager: Object.freeze([
    { id: "overview", label: "Open Overview and review what needs Manager action", route: "home" },
    { id: "team", label: "Open Team and confirm your authorised people scope", route: "team" },
    { id: "work", label: "Open Work and review an item that needs Manager attention", route: "work" },
    { id: "projects", label: "Open Projects and inspect delivery context", route: "projects" },
    { id: "leave", label: "Review Time & Leave and the Manager-first approval boundary", route: "attendance" },
    { id: "messages", label: "Open Messages and review your operational rooms", route: "messages" },
  ]),
  admin: Object.freeze([
    { id: "overview", label: "Open Overview and identify Administration priorities", route: "home" },
    { id: "people", label: "Open People & Access and understand invite/assignment boundaries", route: "people" },
    { id: "leave", label: "Review Time & Leave and Administration final-approval responsibility", route: "attendance" },
    { id: "finance", label: "Open Finance and distinguish operational finance from protected Payroll", route: "finance" },
    { id: "settings", label: "Open Control Center and review administrative configuration entry points", route: "settings" },
    { id: "account", label: "Open Your account and review account activity/security guidance", route: "account" },
  ]),
  executive: Object.freeze([
    { id: "overview", label: "Open Overview and review leadership attention", route: "home" },
    { id: "ministry", label: "Open Ministry and inspect strategic direction", route: "strategy" },
    { id: "portfolio", label: "Open Portfolio and inspect delivery across projects", route: "delivery" },
    { id: "organisation", label: "Open Organisation and review operating context", route: "exec-organisation" },
    { id: "finance", label: "Open Finance and review executive financial context", route: "exec-finance" },
    { id: "reports", label: "Open Reports and trace a summary back to its underlying evidence", route: "exec-reports" },
  ]),
});

export const CEAC_GUIDE_ARTICLES = Object.freeze([
  {
    id: "getting-started",
    title: "Getting started",
    summary: "Understand your CEAC workspace, your current role and where to begin without learning the system architecture.",
    roles: ALL,
    routes: ["home"],
    keywords: ["start", "navigation", "role", "unit", "workspace", "today", "overview"],
    primaryRoute: "home",
    sections: [
      {
        title: "What CEAC shows you",
        body: [
          "CEAC OS is organised around the work you are authorised to do. Staff, Managers, Administration and the Group Pastor see different operating surfaces.",
          "Your visible destinations are not a list of technical permissions. They are the practical places you need for your role.",
        ],
      },
      {
        title: "Where to begin",
        steps: [
          "Open Home or Overview to see what needs attention now.",
          "Use Work for assignments, requests, submissions and review activity.",
          "Use Messages for operational communication and rooms.",
          "Use My Hub for your personal CEAC information and self-service actions.",
          "If you belong to more than one unit, use the unit switcher to change working context. Switching context does not create another account.",
        ],
      },
      {
        title: "What happens next",
        body: [
          "Actions that require another person keep their own review state. CEAC does not silently turn a request into an approval or a missing record into a negative judgement.",
        ],
      },
    ],
  },
  {
    id: "home-and-attention",
    title: "Home and what needs attention",
    summary: "Use Today or Overview to understand your next operational actions without treating every number as a score.",
    roles: ALL,
    routes: ["home"],
    keywords: ["home", "overview", "today", "attention", "queue", "numbers", "status"],
    primaryRoute: "home",
    sections: [
      {
        title: "What it means",
        body: [
          "Home is an operational starting point. Counts and queues should lead to the underlying work, people or records that explain them.",
          "CEAC does not use a single composite employee score or treat presence as productivity.",
        ],
      },
      {
        title: "How to use it",
        steps: [
          "Start with items marked as needing action, review or follow-up.",
          "Open the underlying record before making a consequential decision.",
          "Use the relevant domain—Work, Time & Leave, People, Finance or another authorised surface—to complete the action.",
        ],
      },
      {
        title: "If something looks wrong",
        body: [
          "Open the underlying record and check its dates, status and attributable history. Do not correct a dashboard number by inventing data.",
        ],
      },
    ],
  },
  {
    id: "work-and-review",
    title: "Work, submissions and review",
    summary: "Understand assignments, evidence, review and outcomes without confusing activity with approval.",
    roles: ALL,
    routes: ["work"],
    keywords: ["work", "task", "assignment", "submission", "review", "approve", "return", "evidence"],
    primaryRoute: "work",
    sections: [
      {
        title: "What it means",
        body: [
          "Work keeps the assignment, expected outcome, evidence, submission and review history together.",
          "A submitted item is not automatically approved. Review authority follows the recorded responsibility and CEAC authority rules.",
        ],
      },
      {
        title: "How to use it",
        steps: [
          "Open the work item and read its expected outcome and context.",
          "Record progress or evidence in the work item rather than creating a parallel private record.",
          "Submit for review when the required work is ready.",
          "If you are the authorised reviewer, approve or return with a clear reason.",
        ],
      },
      {
        title: "If something is blocked",
        body: [
          "Use the work item's blocker, clarification or follow-up path where available. A missing update should not be rewritten as a completed outcome.",
        ],
      },
    ],
  },
  {
    id: "time-and-leave",
    title: "Time & Leave",
    summary: "Request leave, understand annual working-day balances and read attendance evidence without automatic punishment or Payroll assumptions.",
    roles: ["staff", "manager", "admin"],
    routes: ["attendance"],
    keywords: ["leave", "annual", "sick", "maternity", "paternity", "study", "attendance", "schedule", "working days", "absence"],
    primaryRoute: "attendance",
    sections: [
      {
        title: "Annual leave",
        body: [
          "The confirmed allowance is 24 working days per leave year: 15 annual days plus one shared nine-day sick/study allowance. A completed quarter credits 3.75 annual days and 2.25 shared days.",
          "A joiner receives a pro-rated credit for the portion of the first completed quarter served. Ordinary unused Annual leave expires at year end, subject to protected exceptions and already-approved cross-year leave.",
          "Annual leave usage is counted from attributable workforce schedule evidence. CEAC does not silently assume a Monday-Friday pattern when the required schedule is missing.",
        ],
      },
      {
        title: "How approval works",
        steps: [
          "The employee requests leave.",
          "The relevant Manager reviews first.",
          "Administration makes the final approval decision.",
        ],
      },
      {
        title: "Other leave categories",
        body: [
          "Sick and Study requests draw from the same shared nine-day yearly allowance; they do not each receive nine days. Only final approved requests reduce it. Maternity and Paternity keep their separate policy treatment; this shared allowance does not set their entitlements.",
        ],
      },
      {
        title: "Attendance is evidence, not judgement",
        body: [
          "No work session recorded does not automatically prove absence or misconduct. Attendance and leave evidence may require human review, but they do not automatically create discipline or a salary deduction.",
        ],
      },
    ],
  },
  {
    id: "calendar-and-schedule",
    title: "Calendar and working schedule",
    summary: "Use your calendar and effective schedule to understand expected work context, meetings and leave overlays.",
    roles: ["staff", "manager", "admin", "executive"],
    routes: ["staff-calendar", "calendar", "admin-calendar", "exec-calendar"],
    keywords: ["calendar", "schedule", "week", "meeting", "working pattern", "hours", "day type"],
    sections: [
      {
        title: "What it means",
        body: [
          "Calendar combines attributable schedule context with operational events that you are allowed to see.",
          "A schedule is effective-dated. CEAC should use the schedule that applied on the date in question rather than rewriting history with today's pattern.",
        ],
      },
      {
        title: "How to use it",
        steps: [
          "Check the day or week before planning work or leave.",
          "Open the underlying meeting or work item for its authoritative detail.",
          "If a schedule is wrong, use the authorised correction/configuration path rather than treating the visible mismatch as employee misconduct.",
        ],
      },
    ],
  },
  {
    id: "messages-and-announcements",
    title: "Messages and announcements",
    summary: "Know when to use a room, an announcement or a work item so operational communication stays attributable.",
    roles: ALL,
    routes: ["messages", "announcements"],
    keywords: ["messages", "room", "announcement", "communication", "urgent", "update"],
    primaryRoute: "messages",
    sections: [
      {
        title: "Choose the right surface",
        body: [
          "Use a room for operational conversation in an authorised unit, sub-team or project context.",
          "Use an announcement for information that should be published to a defined audience.",
          "Use Work when the communication creates an assignment, request, review or accountable deliverable.",
        ],
      },
      {
        title: "What happens next",
        body: [
          "Read/unread communication state does not silently change work-review state. Important operational actions should remain visible in their authoritative record.",
        ],
      },
    ],
  },
  {
    id: "my-hub-and-account",
    title: "My Hub and your account",
    summary: "Use personal self-service surfaces without confusing profile information with organisational authority.",
    roles: ALL,
    routes: ["me", "account"],
    keywords: ["my hub", "account", "profile", "password", "activity", "personal"],
    primaryRoute: "me",
    sections: [
      {
        title: "My Hub",
        body: [
          "My Hub is your personal CEAC operating space for information and actions that belong to you.",
          "Your visible job title or unit does not by itself grant system authority.",
        ],
      },
      {
        title: "Your account",
        body: [
          "Account activity helps you understand attributable access activity. Never share your password with another staff member, Manager, Technical Support or the builder.",
        ],
      },
      {
        title: "If you cannot sign in",
        steps: [
          "Use the approved activation or password-recovery flow rather than a shared password.",
          "Keep the visible error message and approximate time so support can diagnose the problem.",
          "Do not send passwords, recovery links or authentication codes in ordinary messages.",
        ],
      },
    ],
  },
  {
    id: "team-and-projects",
    title: "Managing a team and projects",
    summary: "Use Manager surfaces for authorised people, work, projects and review without gaining Administration authority.",
    roles: ["manager"],
    routes: ["team", "projects", "manager-reports", "manager-finance"],
    keywords: ["manager", "team", "projects", "review", "finance", "reports", "people"],
    primaryRoute: "team",
    sections: [
      {
        title: "Your Manager boundary",
        body: [
          "Manager authority is limited to the units and responsibilities actually assigned to you. It does not make you Administration, HR or an organisation-wide authority.",
        ],
      },
      {
        title: "How to use the command centre",
        steps: [
          "Use Team for people in your authorised scope.",
          "Use Work and Projects for assignments, execution, evidence and review.",
          "Use Time & Leave for Manager-first leave review and attributable attendance context.",
          "Use Finance and Reports only for the operational scope exposed to your Manager role.",
        ],
      },
      {
        title: "What you cannot infer",
        body: [
          "Do not infer salary, protected HR details, organisation-wide capability or disciplinary guilt from the Manager view.",
        ],
      },
    ],
  },
  {
    id: "people-and-access",
    title: "People & Access",
    summary: "Invite, assign and manage organisational access without creating duplicate identities or using job titles as permissions.",
    roles: ["admin"],
    routes: ["people", "settings"],
    keywords: ["people", "access", "invite", "activation", "unit", "manager", "responsibility", "offboarding"],
    primaryRoute: "people",
    sections: [
      {
        title: "One person, one account",
        body: [
          "A person may hold multiple unit memberships and responsibilities under one CEAC identity. Adding a responsibility is not the same as inviting a new person.",
        ],
      },
      {
        title: "How to onboard",
        steps: [
          "Invite the person through the authorised People & Access flow.",
          "Assign the correct organisational placement and Manager relationship.",
          "The person verifies activation and creates their own password.",
          "Use additive responsibility when an existing person needs another unit responsibility instead of creating another account.",
        ],
      },
      {
        title: "Authority rule",
        body: [
          "Administration remains the ultimate People & Access authority. Access is capability-based; a selected unit, job title or visible role label must not silently create organisation-wide permission.",
        ],
      },
    ],
  },
  {
    id: "finance-and-payroll",
    title: "Finance and Payroll boundaries",
    summary: "Understand operational finance, protected Payroll authority and why attendance never posts deductions automatically.",
    roles: ["manager", "admin", "executive"],
    routes: ["finance", "manager-finance", "exec-finance", "payroll"],
    keywords: ["finance", "payroll", "salary", "deduction", "approval", "protected"],
    sections: [
      {
        title: "Finance",
        body: [
          "Finance is an operational CEAC surface. It does not replace every external accounting record where CEAC policy still keeps another source authoritative.",
        ],
      },
      {
        title: "Payroll",
        body: [
          "Administration prepares Payroll and the Group Pastor approves it. Approved Payroll is not silently rewritten; corrections must remain attributable.",
          "Attendance, leave or a missing work session never posts a Payroll deduction automatically. Any salary consequence requires an authorised human decision before Payroll calculation and review.",
        ],
      },
      {
        title: "Protected information",
        body: [
          "Salary, payment and protected HR content is restricted. Seeing that a protected subsystem has a problem does not grant access to its confidential payload.",
        ],
      },
    ],
  },
  {
    id: "executive-operating-view",
    title: "Executive operating view",
    summary: "Use Ministry, Portfolio, Organisation, Finance and Reports for leadership decisions without bypassing operational records.",
    roles: ["executive"],
    routes: ["strategy", "delivery", "exec-organisation", "exec-finance", "exec-reports"],
    keywords: ["executive", "ministry", "portfolio", "organisation", "leadership", "reports"],
    primaryRoute: "strategy",
    sections: [
      {
        title: "What it means",
        body: [
          "The executive experience brings ministry direction, portfolio delivery, organisation context, finance and reporting together without turning leadership access into hidden technical super-admin access.",
        ],
      },
      {
        title: "How to use it",
        steps: [
          "Use Ministry for strategic direction and ministry objectives.",
          "Use Portfolio for delivery across projects and organisational work.",
          "Open the underlying record before making a consequential decision.",
          "Use the relevant approval surface for Payroll or other protected decisions rather than approving from a summary card.",
        ],
      },
    ],
  },
  {
    id: "privacy-attendance-and-location",
    title: "Privacy, attendance and location evidence",
    summary: "Understand what location evidence means, what it does not mean and how CEAC limits its use.",
    roles: ["staff", "manager", "admin"],
    routes: ["attendance", "account"],
    keywords: ["privacy", "location", "gps", "attendance", "evidence", "tracking", "geofence"],
    sections: [
      {
        title: "What may be recorded",
        body: [
          "Where the attendance feature requires it, CEAC may record discrete location evidence such as coordinates, accuracy, geofence context and timestamps for a work-session event.",
          "CEAC does not use continuous background GPS tracking.",
        ],
      },
      {
        title: "What it does not prove",
        body: [
          "A missing or failed location check does not automatically prove absence, misconduct or a Payroll consequence. Relevant schedule, approved leave, notices, corrections and other evidence must be considered.",
        ],
      },
      {
        title: "Handle sensitive information carefully",
        body: [
          "Do not place medical, Payroll, identity or protected HR documents in ordinary rooms, support messages or work records unless that feature is specifically approved for that data class.",
        ],
      },
    ],
  },
  {
    id: "documents-and-files",
    title: "Documents and files",
    summary: "Place files in the correct operational or protected surface so access and history remain attributable.",
    roles: ALL,
    routes: ["work", "projects", "people"],
    keywords: ["documents", "files", "attachments", "upload", "download", "protected hr", "evidence"],
    sections: [
      {
        title: "What files mean in CEAC",
        body: [
          "A file should stay attached to the operational record it supports—such as Work, a Project, or an approved protected-HR surface—rather than becoming an unrelated shared-drive link.",
          "Operational files and protected HR/Payroll documents have different access boundaries.",
        ],
      },
      {
        title: "Who can act",
        body: [
          "You may upload or open a file only where your recorded CEAC authority permits it. Technical Support does not automatically gain access to protected content simply because a file or subsystem has a technical problem.",
        ],
      },
      {
        title: "How to use files safely",
        steps: [
          "Open the record the file belongs to.",
          "Use that record's file or attachment control.",
          "Check the visible audience or protected context before uploading.",
          "Do not place medical, salary, identity or protected HR documents in ordinary rooms or general Work evidence.",
        ],
      },
      {
        title: "If a file will not open",
        body: [
          "Keep the file name, the feature you opened it from and the visible error. Do not move protected content into a less secure feature just to bypass an access or storage problem.",
        ],
      },
    ],
  },
  {
    id: "notifications-and-updates",
    title: "Notifications and updates",
    summary: "Understand new, changed, urgent, waiting, review and completed states without confusing a notification with the authoritative record.",
    roles: ALL,
    routes: ["home", "messages"],
    keywords: ["notification", "notifications", "updates", "new", "changed", "urgent", "waiting", "review", "completed"],
    sections: [
      {
        title: "What a notification means",
        body: [
          "A notification or attention marker tells you that something changed or may require action. The underlying Work, Leave, Message, People, Finance or other record remains authoritative.",
        ],
      },
      {
        title: "What to do",
        steps: [
          "Open the underlying record.",
          "Read the current status and attributable history.",
          "Complete the action in that record rather than treating the notification itself as approval, completion or evidence.",
        ],
      },
      {
        title: "Who can act",
        body: [
          "The ability to see an update does not automatically grant authority to approve or change the underlying record. CEAC still applies the relevant role/capability boundary.",
        ],
      },
      {
        title: "If an update looks stale",
        body: [
          "Refresh the relevant record first. If the underlying state is correct but the attention marker is not, report the feature and visible state without recreating or deleting the authoritative record.",
        ],
      },
    ],
  },
  {
    id: "offline-and-installation",
    title: "Installable app and offline behavior",
    summary: "Know what CEAC can show offline and why live organisational records still require a secure connection.",
    roles: ALL,
    routes: [],
    keywords: ["offline", "install", "pwa", "connection", "cache", "update"],
    sections: [
      {
        title: "Offline boundary",
        body: [
          "CEAC may keep the non-sensitive application shell and Guide resources available for resilience. Ordinary business records such as Work, People, Leave, Finance and Messages remain online-only.",
          "Protected HR, Payroll, security, MFA and audit data must never be cached for offline convenience.",
        ],
      },
      {
        title: "When you are offline",
        body: [
          "A screen that requires live records or an authorised action must say that a secure connection is required. An unsent local draft must never look submitted.",
        ],
      },
      {
        title: "App updates",
        body: [
          "When CEAC reports that an update is ready, use the provided update action so the installed app and web experience move to the current version cleanly.",
        ],
      },
    ],
  },
  {
    id: "recover-from-a-problem",
    title: "When something is not working",
    summary: "Capture enough factual information for support without exposing passwords or sensitive content.",
    roles: ALL,
    routes: [],
    keywords: ["help", "support", "error", "sign in", "failed", "problem", "recovery"],
    sections: [
      {
        title: "First checks",
        steps: [
          "Read the visible status or error message; do not repeatedly submit the same consequential action.",
          "Confirm whether you are online and whether the problem affects one feature or the whole app.",
          "Note the approximate time, the feature you were using and what you expected to happen.",
        ],
      },
      {
        title: "What to share with support",
        body: [
          "Share the visible error wording, feature name and non-sensitive steps that led to the problem.",
          "Never share your password, authentication code, recovery link, salary details, medical information or protected HR document just to obtain technical help.",
        ],
      },
      {
        title: "What support should do",
        body: [
          "Technical Support should diagnose access and system problems without automatically receiving protected HR, Payroll, medical or confidential employee content.",
        ],
      },
    ],
  },
]);

export function guideArticlesForRole(role) {
  return CEAC_GUIDE_ARTICLES.filter((article) => article.roles.includes(role));
}

export function guideArticlesForContext(role, route) {
  if (!route) return [];
  return guideArticlesForRole(role).filter((article) => article.routes.includes(route));
}

export function searchGuideArticles(role, query) {
  const articles = guideArticlesForRole(role);
  const term = String(query || "").trim().toLowerCase();
  if (!term) return articles;

  return articles.filter((article) => {
    const text = [
      article.title,
      article.summary,
      ...(article.keywords || []),
      ...(article.sections || []).flatMap((section) => [
        section.title,
        ...(section.body || []),
        ...(section.steps || []),
      ]),
    ].join(" ").toLowerCase();
    return text.includes(term);
  });
}
