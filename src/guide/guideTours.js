export const calendarRoute = (role) => ({
  admin: "admin-calendar", executive: "exec-calendar", manager: "calendar", staff: "staff-calendar",
}[role] || "staff-calendar");

export function guideRole(me, manager = me?.memberships?.some((membership) => membership.role === "manager") || me?.role === "manager") {
  return me?.is_exec ? "executive" : me?.is_admin ? "admin" : manager ? "manager" : "staff";
}

export function guideTours(role) {
  const calendar = calendarRoute(role);
  const shared = role === "manager" ? "Unit calendar" : role === "admin" ? "Organisation calendar" : "Church calendar";
  const projectRoute = role === "admin" ? "admin-projects" : role === "executive" ? "exec-projects" : "projects";
  return [
    { id:"personal-week", title:"Plan my week", article:"calendar-and-schedule", steps:[
      { route:calendar, target:"calendar-personal", title:"Open your personal calendar", text:"Choose My calendar if you also have a shared calendar. This is where you plan your own day." },
      { target:"calendar-views", title:"Choose Week or Agenda", text:"Use Week to check time and Agenda to scan upcoming items. Select a date to see that day’s plan." },
      { target:"calendar-add", title:"Prepare for the day", text:"Use + Add for a private event, task or note. Open Notes to find saved notes later. Dates from CEAC Work and meetings appear alongside your private plans." },
    ] },
    ...(role === "staff" ? [] : [
      { id:"unit-week", title:role === "manager" ? "Plan my unit’s week" : "Plan across the organisation", article:"calendar-unit", steps:[
        { route:calendar, target:"calendar-shared", title:`Open ${shared}`, text:"Check the week before setting dates. Managers with multiple units can switch to the unit they’re planning for." },
        { target:"calendar-filter", title:"Compare availability and delivery dates", text:"Use Filter to compare projects, work, meetings, activities and approved leave. Select a day and open a linked record to see its details." },
        { target:"calendar-activity", title:"Put a shared activity on the calendar", text:"Choose Plan activity for a rehearsal, outreach or programme. Give it a time and audience and link the project where relevant. Save only when the plan is ready." },
        { route:projectRoute, title:"Give preparation work an owner", text:"Open the project to see its objectives and work. Use Work to assign preparation with an owner and due date, then check the relevant calendar for its deadline." },
      ] },
      { id:"project-meeting", title:"Schedule and follow through on a meeting", article:"calendar-meetings", steps:[
        { route:calendar, target:"calendar-shared", title:"Check the shared schedule", text:"Choose a date after checking meetings, work and approved leave." },
        { target:"calendar-meeting", title:"Open the meeting scheduler", text:"Check the date, audience and participants. For project context, choose Project in the scheduler or use Project meeting inside Projects. Send only after checking the details." },
        { route:"meetings", title:"Prepare and follow through", text:"Open a meeting. Use Agenda before it and Recap afterwards. Record shared decisions and use Assign follow-up to give agreed work an owner and due date." },
      ] },
    ]),
    { id:"setup", title:"Set up my CEAC workspace", article:"my-hub-and-account", steps:[
      { route:"me", title:"Check your personal details", text:"Open My Hub and review your personal details. If your recorded department or employment is incorrect, contact HR." },
      { route:"account", title:"Set up alerts and security", text:"Open Notifications to choose alerts for this device. Use Account & Security for the sign-in options available to you." },
    ] },
    { id:"start-work", title:"Start work and submit an outcome", article:"work-and-review", steps:[
      { route:"home", title:"Start your work session", text:"Open Start work. Choose a CEAC location or Off-site and enter your place name. Linking a responsibility off-site is optional. Only start the session when you are ready." },
      { route:"work", title:"Open the work and check the next step", text:"Read the expected outcome, add your evidence and submit when ready. Reopen the item to see the responsible reviewer or any notes asking for changes." },
    ] },
    ...(role === "admin" ? [{ id:"unit-head", title:"Change a Unit Head", article:"people-and-access", steps:[
      { route:"people", title:"Find the unit", text:"In People & Access, use Needs attention to review a unit without a head. For an existing head, open the unit in Units and choose Change Unit Head." },
      { route:"units", title:"Check the incoming head", text:"Choose an active unit member. If the person is missing, add their existing account to the unit from the form and return. Review reporting lines and open work after confirming." },
    ] }] : []),
  ];
}
