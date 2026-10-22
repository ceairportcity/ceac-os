import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openStaffTeam(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".staff-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=team");
  await expect(page.locator(".ev2-people-page.ev2-people-staff")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family B2 Staff Team uses the shared People family without authority drift", () => {
  const screen = readFileSync("src/screens/StaffTeam.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");

  for (const symbol of [
    "PeoplePageHeader",
    "PeopleRoomCard",
    "PeopleSection",
    "PeoplePersonRow",
    "PeopleFactRow",
    "PeopleResourceRow",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
    expect(screen).toContain(symbol);
  }

  for (const protectedPath of [
    'from("unit_memberships")',
    'rpc("list_unit_approved_leave"',
    'from("sub_teams")',
    'from("unit_resources")',
  ]) {
    expect(screen).toContain(protectedPath);
  }

  expect(screen).toContain("ev2-people-page");
  expect(screen).not.toContain("team-primary-tabs");
  expect(screen).not.toContain("team-section-toggle");
  expect(css).toContain(".ev2-people-page");
  expect(css).not.toContain("!important");
  // People styles travel with the lazy People route; the sign-in shell stays lean.
  expect(main).not.toContain('import "./experience-v2/people-family/people-family.css";');
  expect(shared).toContain('import "./people-family.css";');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family B2 Staff Team composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openStaffTeam(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await expect(page.getByText("People", { exact: true }).first()).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-people-page").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden"
            && style.display !== "none"
            && rect.width > 0
            && rect.height > 0
            && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    const actionable = page.locator(".ev2p-room:visible, .ev2p-section-toggle:visible, .ev2p-resource-row:visible");
    const count = await actionable.count();
    for (let index = 0; index < count; index += 1) {
      const box = await actionable.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b2-staff-team-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


async function openManagerTeam(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=team");
  await expect(page.locator(".ev2-people-page.ev2-people-manager")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family B3 Manager Team preserves factual unit scope without scoring", () => {
  const screen = readFileSync("src/screens/Team.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  expect(shared).toContain("export function PeopleEvidencePerson");
  expect(screen).toContain("PeopleEvidencePerson");
  expect(screen).toContain('from("unit_memberships")');
  expect(screen).toContain('.eq("unit_id", me.unit_id)');
  expect(screen).toContain('from("work_items")');
  expect(screen).toContain('.neq("visibility", "private")');
  expect(screen).toContain('from("work_sessions")');
  expect(screen).toContain('from("submissions")');
  expect(screen).toContain('from("leave_requests")');
  expect(screen).toContain('from("pending_invitations")');
  expect(screen).toContain('from("unit_resources")');
  expect(screen).toContain('rpc("swap_sub_team_positions"');
  expect(screen).toContain('rpc("save_unit_resource"');
  expect(screen).toContain('rpc("set_unit_resource_active"');
  expect(screen).toContain("Volunteers use the Staff experience. This invitation does not grant Unit Head, HR, Compliance, Administration or Executive authority.");
  expect(screen).not.toMatch(/productivity score|performance score|ranking/i);
  expect(css).toContain(".ev2p-evidence-person");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family B3 Manager Team composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerTeam(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open room/ })).toBeVisible();
    await expect(page.getByText("People & volunteers", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Work lanes", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team setup", exact: true })).toBeVisible();

    const peopleSection = page.locator(".ev2p-section").filter({ hasText: /^People/ }).first();
    const setupHeading = page.getByRole("heading", { name: "Team setup", exact: true });
    const [peopleBox, setupBox] = await Promise.all([peopleSection.boundingBox(), setupHeading.boundingBox()]);
    expect(peopleBox?.y || 0).toBeLessThan(setupBox?.y || Number.POSITIVE_INFINITY);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-people-manager").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden"
            && style.display !== "none"
            && rect.width > 0
            && rect.height > 0
            && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    const person = page.locator(".ev2p-evidence-person").filter({ hasText: "Staff Fixture" }).first();
    await expect(person).toBeVisible();
    const factualStrip = person.locator(".ev2p-evidence-strip");
    const factualButtons = factualStrip.locator("button");
    expect(await factualButtons.count()).toBe(5);
    const count = await factualButtons.count();
    for (let index = 0; index < count; index += 1) {
      const box = await factualButtons.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }
    if (viewport.width <= 760) {
      const stripBox = await factualStrip.boundingBox();
      expect(stripBox?.height || Number.POSITIVE_INFINITY).toBeLessThanOrEqual(72);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b3-manager-team-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Stage 10 Family B3 Manager Team evidence opens the existing unit-scoped person workspace", async ({ browser }) => {
  const { context, page } = await openManagerTeam(browser, { width: 1366, height: 768 });
  const person = page.locator(".ev2p-evidence-person").filter({ hasText: "Staff Fixture" }).first();
  await expect(person).toBeVisible();
  await person.locator(".ev2p-evidence-strip button").filter({ hasText: "overdue" }).click();
  await expect(page.locator(".manager-person-detail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staff Fixture", exact: true })).toBeVisible();
  await expect(page.getByText(/operational context only/i)).toBeVisible();
  await context.close();
});


async function openManagerPerson(browser, viewport) {
  const { context, page } = await openManagerTeam(browser, viewport);
  const person = page.locator(".ev2p-evidence-person").filter({ hasText: "Staff Fixture" }).first();
  await expect(person).toBeVisible();
  await person.locator(".ev2p-evidence-person-main").click();
  await expect(page.locator(".ev2-person-workspace")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family B4 Manager Person preserves unit scope and visible feedback authority", () => {
  const screen = readFileSync("src/screens/PersonDetail.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  for (const symbol of [
    "PeopleBackButton",
    "PeoplePersonHeader",
    "PeopleEvidenceSummary",
    "PeopleWorkspaceSection",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
    expect(screen).toContain(symbol);
  }

  expect(screen).toContain('.eq("unit_id", me.unit_id)');
  expect(screen).toContain('.eq("profile_id", profileId)');
  expect(screen).toContain('.neq("visibility", "private")');
  expect(screen).toContain('from("work_sessions")');
  expect(screen).toContain('from("submissions")');
  expect(screen).toContain('from("feedback_notes")');
  expect(screen).toContain('rpc("record_performance_feedback"');
  expect(screen).toContain("They are not a productivity score, ranking or judgement about this person.");
  expect(screen).toContain("There are no private manager notes.");
  expect(screen).toContain("They do not measure productivity or determine the quality of this person’s work.");

  const current = screen.indexOf('title="Current responsibilities"');
  const outcomes = screen.indexOf('title="Recent outcomes"');
  const submissions = screen.indexOf('title="Submissions"');
  const objectives = screen.indexOf('title="Projects & objectives"');
  const activity = screen.indexOf('title="Activity context"');
  const feedback = screen.indexOf('title="Visible feedback"');
  expect(current).toBeGreaterThan(-1);
  expect(outcomes).toBeGreaterThan(current);
  expect(submissions).toBeGreaterThan(outcomes);
  expect(objectives).toBeGreaterThan(submissions);
  expect(activity).toBeGreaterThan(objectives);
  expect(feedback).toBeGreaterThan(activity);

  expect(css).toContain("/* Stage 10B4 — Manager Person workspace */");
  expect(css).toContain(".ev2p-evidence-summary");
  expect(css).toContain(".ev2p-workspace-section");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family B4 Manager Person composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerPerson(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Staff Fixture", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current responsibilities", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent outcomes", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity context", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Visible feedback", exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-person-workspace").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden"
            && style.display !== "none"
            && rect.width > 0
            && rect.height > 0
            && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    const touchTargets = page.locator(".ev2p-back:visible, .ev2p-filter-tab:visible, .ev2p-link-row:visible, .ev2p-objective-toggle:visible");
    const count = await touchTargets.count();
    for (let index = 0; index < count; index += 1) {
      const box = await touchTargets.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b4-manager-person-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


async function openAdminPeople(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=people");
  await expect(page.locator(".ev2-people-page.ev2-people-admin")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family B5A Administration People directory preserves HR authority without scoring", () => {
  const screen = readFileSync("src/screens/People.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  for (const symbol of [
    "PeopleAdminPersonRow",
    "PeoplePageHeader",
    "PeopleSection",
    "PeopleEmpty",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
    expect(screen).toContain(symbol);
  }

  expect(screen).toContain('rpc("admin_people_summary")');
  expect(screen).toContain('rpc("admin_person_detail"');
  expect(screen).toContain('rpc("admin_employment_detail"');
  expect(screen).toContain('rpc("admin_update_employment"');
  expect(screen).toContain("Protected HR remains behind a separate security boundary.");
  expect(screen).toContain("They are not a performance score, ranking or disciplinary conclusion.");
  expect(screen).toContain("No submissions in 14 days");
  expect(screen).toContain("PEOPLE_VIEWS");
  expect(screen).toContain('aria-label="People views"');
  expect(screen).toContain("Roster-only status by itself is not treated as a problem.");
  expect(screen).toContain("Record employment change");
  expect(screen).toContain('rpc("admin_employee_roster_summary")');
  expect(screen).toContain('rpc("hr_employee_protected_summary"');
  expect(screen).toContain("Missing data remains explicitly missing until Administration records an authoritative value.");
  expect(css).toContain("/* Stage 10B5 — Administration People / employee workspace */");
  expect(css).toContain(".ev2p-admin-person-row");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family B5A Administration People directory composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminPeople(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "People & Access", exact: true })).toBeVisible();
    await expect(page.getByLabel("Find a person")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Directory", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Organisation", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Needs attention", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Everyone", exact: true })).toBeVisible();
    await expect(page.getByText(/not a performance score, ranking or disciplinary conclusion/i)).toBeVisible();

    await page.getByRole("tab", { name: "Organisation", exact: true }).click();
    await expect(page.getByText(/Job titles never create authority/i).first()).toBeVisible();
    await page.getByRole("tab", { name: "Needs attention", exact: true }).click();
    await expect(page.getByText("Employee records needing attention", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Directory", exact: true }).click();
    await expect(page.locator(".fpg-people-roster")).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-people-admin").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden"
            && style.display !== "none"
            && rect.width > 0
            && rect.height > 0
            && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    const filterButtons = page.locator(".ev2p-admin-filters button:visible");
    const filterCount = await filterButtons.count();
    for (let index = 0; index < filterCount; index += 1) {
      const box = await filterButtons.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    const personRows = page.locator(".fpg-people-roster-row:visible");
    if (await personRows.count()) {
      const box = await personRows.first().boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b5a-admin-people-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


async function openAdminEmployee(browser, viewport) {
  const { context, page } = await openAdminPeople(browser, viewport);
  const row = page.locator(".fpg-people-roster-row").filter({ hasText: "Staff Fixture" }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family B5B Administration employee workspace preserves employment authority", () => {
  const screen = readFileSync("src/screens/People.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  for (const symbol of [
    "PeopleBackButton",
    "PeoplePersonHeader",
    "PeopleWorkspaceSection",
    "PeopleEvidenceSummary",
    "PeopleFactRow",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
    expect(screen).toContain(symbol);
  }

  expect(screen).toContain('rpc("admin_people_summary")');
  expect(screen).toContain('rpc("admin_person_detail"');
  expect(screen).toContain('rpc("admin_employment_detail"');
  expect(screen).toContain('rpc("admin_update_employment"');

  expect(screen).toContain("PERSON_TABS");
  expect(screen).toContain('aria-label="Employee record sections"');
  expect(screen).toContain('className="ev2p-admin-master-list"');
  expect(screen).toContain('personTab === "overview"');
  expect(screen).toContain('personTab === "employment"');
  expect(screen).toContain('personTab === "work"');
  expect(screen).toContain('personTab === "time"');
  expect(screen).toContain('personTab === "documents"');
  expect(screen).toContain('personTab === "history"');
  expect(screen).toContain('personTab === "protected"');
  expect(screen).toContain('title="Time & Leave"');
  expect(screen).toContain('["access","Access"]');
  expect(screen).toContain('rpc("admin_access_invitations")');
  expect(screen).toContain('title="Access & responsibilities"');
  expect(screen).toContain("Job title never grants application authority.");
  expect(screen).toContain("Offboard / deactivate access");

  expect(screen).toContain("These records are not a productivity score, ranking, pay input or disciplinary conclusion.");
  expect(screen).toContain('rpc("hr_employee_protected_summary"');
  expect(screen).toContain('rpc("hr_employee_protected_record"');
  expect(screen).toContain("ProtectedHrComposer");
  expect(screen).toContain("ComposerDrawer");
  expect(screen).toContain("p_replaces_id: form.replacesId || null");
  expect(screen).toContain('setProtectedEditor({ type:"compensation", record:compensation })');
  expect(screen).not.toContain("function ProtectedHrSheet");
  // A permission-verified roster loads before optional, asynchronously signed
  // private employee photos. Allow formatting whitespace, never a public URL.
  expect(screen).toMatch(/listOperationalFilesForContexts\(\s*"employee_photo",\s*rosterRows\.map\(/);
  expect(screen).toContain('listOperationalFiles("employee_document"');
  expect(screen).toContain('contextType: kind === "photo" ? "employee_photo" : "employee_document"');
  expect(screen).toContain('aria-label="Employee photo"');
  expect(screen).toContain('aria-label="Add employee document"');
  expect(shared).toContain('src={src}');
  expect(screen).toContain("Missing data remains explicitly missing until Administration records an authoritative value.");
  expect(screen).toContain('employmentForm.changeType === "correction"');
  expect(screen).toContain('employmentForm.status === "exited"');
  expect(screen).toContain("Record employment change");

  expect(css).toContain("/* Stage 10B5B — Administration employee workspace */");
  expect(css).toContain(".ev2-admin-person-workspace");
  expect(css).toContain(".ev2p-admin-record-grid");
  expect(css).toContain(".ev2p-admin-protected-grid");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family B5B Administration employee workspace composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminEmployee(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Staff Fixture", exact: true })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Employee record sections" })).toBeVisible();
    await expect(page.getByLabel("Employee photo", { exact: true })).toBeVisible();
    for (const tab of ["Overview","Access","Employment","Work","Time & Leave","Documents","History","Protected HR"]) {
      await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    if (viewport.width > 760) await expect(page.locator(".ev2p-admin-master-list")).toBeVisible();
    else await expect(page.locator(".ev2p-admin-master-list")).toBeHidden();

    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Access", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Access & responsibilities", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage responsibilities", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Offboard / deactivate access", exact: true })).toBeVisible();
    await expect(page.getByText(/Job title never grants application authority/i)).toBeVisible();

    await page.getByRole("tab", { name: "Employment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Employment record", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "History", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Employment history", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Work", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work & activity context", exact: true })).toBeVisible();
    await expect(page.getByText(/not a productivity score, ranking, pay input or disciplinary conclusion/i)).toBeVisible();

    await page.getByRole("tab", { name: "Time & Leave", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Time & Leave", exact: true })).toBeVisible();
    await expect(page.getByText(/No work session is not an absence/i)).toBeVisible();

    await page.getByRole("tab", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByLabel("Add employee document", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Protected HR", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Protected HR", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record salary", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record payment details", exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-admin-person-workspace").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden"
            && style.display !== "none"
            && rect.width > 0
            && rect.height > 0
            && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    const targets = page.locator(".ev2p-back:visible, .ev2p-admin-record-change:visible, .ev2-admin-person-workspace .ev2p-link-row:visible");
    const targetCount = await targets.count();
    for (let index = 0; index < targetCount; index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b5b-admin-employee-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Stage 10 Family B5B employment change editor keeps the audited record contract", async ({ browser }) => {
  const { context, page } = await openAdminEmployee(browser, { width: 1366, height: 768 });

  await page.getByRole("tab", { name: "Employment", exact: true }).click();
  await page.getByRole("button", { name: "Record change", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".h2").filter({ hasText: /^Record employment change$/ })).toBeVisible();

  for (const label of [
    "Change",
    "Effective date",
    "Employment type",
    "Job title",
    "Primary unit",
    "Role",
    "Manager",
    "Working pattern",
    "Employment status",
    "Joined",
    "Reason / context",
  ]) {
    await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
  }

  await dialog.getByLabel("Employment status", { exact: true }).selectOption("exited");
  await expect(dialog.getByLabel("Exit date", { exact: true })).toBeVisible();
  await dialog.getByLabel("Change", { exact: true }).selectOption("correction");
  await expect(dialog.getByLabel("Event being corrected", { exact: true })).toBeVisible();

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage10b5b-admin-employment-editor.png",
    fullPage: true,
  });
  await context.close();
});


for (const viewport of [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "tablet-900", width: 900, height: 900 },
]) {
  test(`Stage 10 Family B5C Administration People acceptance matrix at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminPeople(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "People & Access", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const row = page.locator(".fpg-people-roster-row").filter({ hasText: "Staff Fixture" }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Employment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Employment record", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Protected HR", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Protected HR", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10b5c-admin-employee-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Stage 10 Family B5C Administration People states stay factual and usable", async ({ browser }) => {
  const { context, page } = await openAdminPeople(browser, { width: 390, height: 844 });

  const search = page.getByLabel("Find a person");
  await search.fill("No such CEAC person");
  await expect(page.getByText("Nobody matches", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(page.locator(".fpg-people-roster-row").filter({ hasText: "Staff Fixture" }).first()).toBeVisible();

  await page.locator(".fpg-people-roster-row").filter({ hasText: "Staff Fixture" }).first().click();
  await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible();
  await page.getByRole("tab", { name: "Employment", exact: true }).click();
  await page.getByRole("button", { name: "Record change", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".h2").filter({ hasText: /^Record employment change$/ })).toBeVisible();
  await dialog.getByLabel("Employment status", { exact: true }).selectOption("exited");
  await expect(dialog.getByLabel("Exit date", { exact: true })).toBeVisible();
  await dialog.getByLabel("Change", { exact: true }).selectOption("correction");
  await expect(dialog.getByLabel("Event being corrected", { exact: true })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage10b5c-admin-employment-editor-phone-390.png",
    fullPage: true,
  });
  await context.close();
});


test("VF3C Manager Team and Person workspace locks factual command composition", () => {
  const team = readFileSync("src/screens/Team.jsx", "utf8");
  const person = readFileSync("src/screens/PersonDetail.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  expect(team).toContain("Volunteer request recorded for HR review. No activation email was sent yet.");
  expect(team).toContain("PeopleEvidencePerson");
  expect(person).toContain('className="ev2p-person-layout"');
  expect(person).toContain('className="ev2p-person-context-rail"');
  expect(person).toContain('className="ev2p-person-detail-stack"');
  expect(person).toContain("They are not a productivity score, ranking or judgement about this person.");
  expect(person).toContain("There are no private manager notes.");

  expect(css).toContain("/* VF3C — Manager Team and Person workspace");
  expect(css).toContain(".ev2-people-manager .ev2p-stack");
  expect(css).toContain(".ev2p-person-context-rail");
  expect(css).toContain("position: sticky");
  expect(css).toContain("grid-template-columns: minmax(15.5rem, 17.5rem) minmax(0, 1fr)");
  expect(css).not.toContain("!important");
});


test("VF4B Administration People and employee workspace lock operations-console composition", () => {
  const screen = readFileSync("src/screens/People.jsx", "utf8");
  const css = readFileSync("src/experience-v2/people-family/people-family.css", "utf8");

  expect(screen).toContain('className="ev2p-admin-control-band"');
  expect(screen).not.toContain('className="ev2p-admin-control-band">\\n');
  expect(screen).toContain('className="ev2p-admin-person-layout"');
  expect(screen).toContain('className="ev2p-admin-person-rail"');
  expect(screen).toContain('className="ev2p-admin-person-detail"');
  expect(screen).toContain('aria-label="Employee record sections"');

  expect(screen).toContain('rpc("admin_people_summary")');
  expect(screen).toContain('rpc("admin_person_detail"');
  expect(screen).toContain('rpc("admin_employment_detail"');
  expect(screen).toContain('rpc("admin_update_employment"');
  expect(screen).toContain("These records are not a productivity score, ranking, pay input or disciplinary conclusion.");
  expect(screen).toContain('rpc("admin_employee_roster_summary")');
  expect(screen).toContain('rpc("hr_employee_protected_summary"');
  expect(screen).toContain("Missing data remains explicitly missing until Administration records an authoritative value.");

  expect(css).toContain("/* VF4B — Administration People / Employee workspace fidelity.");
  expect(css).toContain(".ev2p-admin-person-rail");
  expect(css).toContain("position: sticky");
  expect(css).toContain("grid-template-columns: minmax(15.5rem, 18rem) minmax(0, 1fr)");
  expect(css).toContain(".ev2-people-admin > .ev2p-section");
  expect(css).not.toContain("!important");
});


test("Phase 5C person access hands off to the controlled lifecycle instead of directly mutating access", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const lifecycle = readFileSync("src/screens/AdminLifecycle.jsx", "utf8");
  const access = readFileSync("src/components/PeopleAccess.jsx", "utf8");

  expect(app).toContain("function openLifecycle(profileId = null");
  expect(app).toContain("initialProfileId={lifecycleIntent?.profileId || null}");
  expect(lifecycle).toContain("Completing offboarding is the authoritative path that deactivates operational access.");
  expect(lifecycle).toContain("setCreateOpen(true)");
  expect(access).toContain('onLifecycle(form.person, "offboarding")');
});
