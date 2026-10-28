import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  { key: "staff", email: "staff@ceac.local.test", app: ".staff-app", personalDomains: true },
  { key: "manager", email: "manager@ceac.local.test", app: ".manager-app", personalDomains: true },
  { key: "admin", email: "admin@ceac.local.test", app: ".office-app", personalDomains: false },
  { key: "executive", email: "exec@ceac.local.test", app: ".executive-app", personalDomains: false },
];

async function openHub(browser, role, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=me");
  await expect(page.locator(".ev2-personal-hub")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "My Hub", exact: true })).toBeVisible();
  await expect(page.getByLabel("Loading My Hub")).toHaveCount(0, { timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family G2 preserves My Hub personal authority while establishing V2 personal-family presentation", async () => {
  const family = readFileSync("src/experience-v2/personal-family/PersonalFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/personal-family/personal-family.css", "utf8");
  const me = readFileSync("src/screens/Me.jsx", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");
  const classifier = readFileSync("scripts/ci/classify-verification.mjs", "utf8");
  const levelA = readFileSync("scripts/ci/run-level-a-browser.sh", "utf8");

  for (const symbol of [
    "PersonalPageHeader",
    "PersonalDestinationGrid",
    "PersonalDestinationCard",
    "PersonalTabs",
    "PersonalSection",
    "PersonalRecordRow",
    "PersonalEmpty",
    "PersonalDetailGrid",
    "PersonalBoundary",
  ]) {
    expect(family).toContain(`export function ${symbol}`);
  }

  expect(main).toContain('import "./experience-v2/personal-family/personal-family.css";');
  expect(me).toContain('supabase.rpc("update_my_personal_details"');
  expect(me).toContain('supabase.from("personal_goals")');
  expect(me).toContain('supabase.from("personal_reminders")');
  expect(me).toContain('supabase.from("profile_personal_details")');
  expect(me).toContain('supabase.from("profiles")');
  expect(me).toContain("Your personal goals are not counted in CEAC reports");
  expect(me).toContain("Protected HR records");
  expect(me).toContain("Editing is disabled so unseen emergency-contact or address information cannot be overwritten with blanks.");
  expect(me).not.toContain("staff-page-intro");
  expect(me).not.toContain("hub-entry-grid");
  expect(css).toContain(".ev2-personal-page");
  expect(css).not.toContain("!important");

  expect(classifier).toContain('["personal", /personal-family');
  expect(classifier).toContain("person(?!al)");
  expect(levelA).toContain("personal)");
  expect(levelA).toContain("tests/experience-v2-personal-*.spec.js");
});

test("Stage 10 Family G2 keeps a failed private-details read from becoming an editable blank profile", async ({ browser }) => {
  const role = roles[0];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/profile_personal_details*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture private details read failed" }),
    });
  });

  await page.goto("/?tab=me");
  await expect(page.locator(".ev2-personal-hub")).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "Personal", exact: true }).click();

  await expect(page.getByText("Private contact details could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit personal details", exact: true })).toBeDisabled();
  await expect(page.getByText(/cannot be overwritten with blanks/i)).toBeVisible();
  await context.close();
});

for (const role of roles) {
  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "laptop-1366", width: 1366, height: 768 },
  ]) {
    test(`Stage 10 Family G2 ${role.key} My Hub preserves role-specific personal destinations at ${viewport.name}`, async ({ browser }) => {
      const { context, page } = await openHub(browser, role, { width: viewport.width, height: viewport.height });

      await expect(page.getByRole("button", { name: "My work history", exact: true })).toBeVisible();
      for (const label of ["Reviews & development", "My workforce context", "Learning", "My assets", "My compliance"]) {
        const button = page.locator(".ev2-personal-hub").getByRole("button", { name: label, exact: true });
        if (role.personalDomains) await expect(button).toBeVisible();
        else await expect(button).toHaveCount(0);
      }

      for (const tab of ["Goals", "Leave", "Personal"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${role.key} My Hub overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: `test-artifacts/redesign-r7-stage10g2-${role.key}-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    });
  }
}

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G2 richest Staff My Hub composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });

    await expect(page.getByText(/personal goals are not counted in CEAC reports/i)).toBeVisible();

    const destinationHeights = await page.locator(".ev2pf-destination").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height)
    );
    expect(Math.min(...destinationHeights)).toBeGreaterThanOrEqual(44);

    const tabHeights = await page.locator(".ev2pf-tabs .ev2c-segmented-item").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height)
    );
    expect(Math.min(...tabHeights)).toBeGreaterThanOrEqual(44);

    const compactActionHeights = await page.locator(".ev2pf-section-action .ev2c-button:visible, .ev2pf-row-action .ev2c-button:visible").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height)
    );
    if (compactActionHeights.length) expect(Math.min(...compactActionHeights)).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff My Hub overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-personal-hub").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10g2-staff-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("Stage 10 Family G3 keeps personal leave inside established workforce authority", async () => {
  const me = readFileSync("src/screens/Me.jsx", "utf8");

  expect(me).toContain('supabase.rpc("workforce_request_leave"');
  expect(me).toContain('supabase.rpc("workforce_leave_action"');
  expect(me).toContain('p_action: "cancelled_by_employee"');
  expect(me).toContain("Manager and Administration decisions remain in Time & Leave.");
  expect(me).toContain("Open Time & Leave");
  expect(me).toContain("CEAC OS will not invent an annual leave balance.");
  expect(me).toContain("It never turns leave or attendance into a Payroll deduction automatically.");
  expect(me).toContain('disabled={busy || !startDate || !endDate || endDate < startDate}');
  expect(me).not.toContain("manager_approved");
  expect(me).not.toContain("admin_approved");
  expect(me).not.toContain('className="leave-summary"');
  expect(me).not.toContain("<Sheet");
  expect(me).not.toContain("<FieldGroup");
  expect(me).toContain('className="leave-request-row"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G3 Staff personal leave composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });

    await page.getByRole("tab", { name: "Leave", exact: true }).click();
    await expect(page.locator(".ev2pf-section").filter({ hasText: "Time away" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask for leave", exact: true })).toBeVisible();
    await expect(page.getByText(/Manager and Administration decisions remain in Time & Leave/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Personal leave overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const actionHeights = await page.locator(".ev2pf-section-action .ev2c-button:visible, .ev2pf-row-action .ev2c-button:visible").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height)
    );
    if (actionHeights.length) expect(Math.min(...actionHeights)).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10g3-staff-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Stage 10 Family G3 leave request uses the V2 guided modal without inventing day totals", async ({ browser }) => {
  const { context, page } = await openHub(browser, roles[0], { width: 390, height: 844 });

  await page.getByRole("tab", { name: "Leave", exact: true }).click();
  await page.getByRole("button", { name: "Ask for leave", exact: true }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask for leave", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annual", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sick", exact: true })).toBeVisible();
  await expect(page.getByLabel("Leave starts", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Leave ends", { exact: true })).toBeVisible();
  await expect(page.getByText(/counts working days from your attributable workforce schedule when that schedule is complete/i)).toBeVisible();
  await expect(page.getByText(/That is .* day/i)).toHaveCount(0);

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage10g3-staff-phone-390-leave-modal.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});


for (const role of roles) {
  test(`Stage 10 Family G3 preserves personal Time & Leave deep-link scope for ${role.key}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, role, { width: 390, height: 844 });
    await page.getByRole("tab", { name: "Leave", exact: true }).click();

    const link = page.getByRole("button", { name: "Open Time & Leave", exact: true });
    if (role.personalDomains) await expect(link).toBeVisible();
    else await expect(link).toHaveCount(0);

    await context.close();
  });
}


test("Stage 10 Family G4 keeps Reviews & development evidence-first while aligning the personal surface", async () => {
  const performance = readFileSync("src/screens/Performance.jsx", "utf8");
  const css = readFileSync("src/experience-v2/personal-family/personal-family.css", "utf8");

  for (const contract of [
    'rpc("record_appraisal_entry"',
    'rpc("record_development_plan_version"',
    'rpc("record_performance_feedback"',
    'rpc("respond_to_performance_feedback"',
    "There is no employee score or ranking.",
    "Activity sessions are shown only as context.",
    "There are no private manager notes in this surface.",
    "Employee response",
    "Development plan",
  ]) {
    expect(performance).toContain(contract);
  }

  expect(performance).toContain('title="Reviews & development"');
  expect(performance).toContain('statusLabel="Evidence-first review"');
  expect(performance).toContain("ev2-personal-review");
  expect(css).toContain(".ev2-personal-review");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G4 Staff Reviews & development composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "Reviews & development", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Reviews & development", exact: true })).toBeVisible();
    await expect(page.getByText(/does not score or rank you/i)).toBeVisible();
    await expect(page.locator(".ev2-personal-review")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff Reviews & development overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10g4-staff-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("Stage 10 Family G5 keeps personal Learning factual while aligning it with My Hub", async () => {
  const learning = readFileSync("src/screens/Learning.jsx", "utf8");
  expect(learning).toContain('supabase.rpc("learning_complete_module"');
  expect(learning).toContain('supabase.from("training_records")');
  expect(learning).toContain("does not turn learning activity into a skill, performance or potential score");
  expect(learning).toContain("No employee learning score is calculated.");
  expect(learning).toContain("ev2-personal-learning");
  expect(learning).toContain('statusLabel="Personal learning"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G5 Staff Learning composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "Learning", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Learning", exact: true })).toBeVisible();
    await expect(page.locator(".ev2-personal-learning")).toBeVisible();
    await expect(page.getByText(/not converted into a skill, performance or potential score/i)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff Learning overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10g5-staff-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("Stage 10 Family G6A keeps personal Assets custody factual while aligning it with My Hub", async () => {
  const assets = readFileSync("src/screens/Assets.jsx", "utf8");
  expect(assets).toContain('supabase.from("asset_items")');
  expect(assets).toContain('supabase.from("asset_assignment_events")');
  expect(assets).toContain('supabase.from("asset_lifecycle_events")');
  expect(assets).toContain("does not remotely wipe, lock, configure or monitor device operating systems");
  expect(assets).toContain("ev2-personal-assets");
  expect(assets).toContain('statusLabel="My custody"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G6A Staff Assets composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "My assets", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Assets & devices", exact: true })).toBeVisible();
    await expect(page.locator(".ev2-personal-assets")).toBeVisible();
    await expect(page.getByText(/does not remotely manage your device/i)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff Assets overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10g6-staff-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("Stage 10 Family G6B keeps personal Compliance factual while aligning it with My Hub", async () => {
  const compliance = readFileSync("src/screens/Compliance.jsx", "utf8");
  expect(compliance).toContain('rpc("compliance_acknowledge_policy"');
  expect(compliance).toContain('rpc("compliance_submit_evidence"');
  expect(compliance).toContain('rpc("compliance_request_exception"');
  expect(compliance).toContain("does not calculate an employee compliance score");
  expect(compliance).toContain("ev2-personal-compliance");
  expect(compliance).toContain('statusLabel="My compliance"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G6B Staff Compliance composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "My compliance", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Compliance", exact: true })).toBeVisible();
    await expect(page.locator(".ev2-personal-compliance")).toBeVisible();
    await expect(page.getByText(/does not calculate a personal compliance score/i)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff Compliance overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10g7-staff-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("Stage 10 Family G supplemental keeps My work history factual while aligning it with My Hub", async () => {
  const record = readFileSync("src/screens/Record.jsx", "utf8");
  expect(record).toContain('supabase.from("work_items")');
  expect(record).toContain('supabase.from("work_sessions")');
  expect(record).toContain('supabase.from("feedback_notes")');
  expect(record).toContain('supabase.rpc("reconcile_closed_work_session"');
  expect(record).toContain("Private work and personal goals remain outside this history.");
  expect(record).toContain("ev2-personal-record");
  expect(record).toContain('aria-label="History month"');
  expect(record).toContain('aria-label="History year"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G supplemental My work history composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "My work history", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My work history", exact: true })).toBeVisible();
    await expect(page.locator(".ev2-personal-record")).toBeVisible();
    await expect(page.getByLabel("History month")).toBeVisible();
    await expect(page.getByLabel("History year")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `My work history overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10g8-record-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}



test("Stage 10 Family G7 keeps account activity self-only while aligning it with My Hub", async () => {
  const account = readFileSync("src/screens/AccountActivity.jsx", "utf8");
  const css = readFileSync("src/experience-v2/personal-family/personal-family.css", "utf8");

  expect(account).toContain('supabase.rpc("my_sessions")');
  expect(account).toContain('supabase.rpc("my_account_activity", { p_limit: 50 })');
  expect(account).toContain('supabase.auth.signOut({ scope: "local" })');
  expect(account).toContain('supabase.auth.signOut({ scope: "global" })');
  expect(account).toContain("Only you can see this.");
  expect(account).toContain('statusLabel="Your account only"');
  expect(account).toContain("ev2-personal-account");
  expect(account).toContain("This is not a colleague-monitoring surface.");
  expect(account).toContain("Signed-in devices could not load");
  expect(account).toContain("Recent account activity could not load");
  expect(account).toContain("!sessionError && sessions.length === 0");
  expect(account).toContain("!activityError && events.length === 0");
  expect(account).toContain("setSessionError(s.error ? humanError");
  expect(account).toContain("setActivityError(a.error ? humanError");
  expect(account).not.toContain("profile_id");
  expect(account).not.toContain("employee_id");
  expect(css).toContain(".ev2-personal-account");
  expect(css).not.toContain("!important");
});

test("Stage 10 Family G7 keeps a sessions read failure distinct from a truthful empty account", async ({ browser }) => {
  const { context, page } = await openHub(browser, roles[0], { width: 390, height: 844 });
  await page.route("**/rest/v1/rpc/my_sessions", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture sessions read failed" }),
    });
  });

  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();
  await page.getByRole("tab",{name:"Sessions",exact:true}).click();
  await expect(page.getByText("Signed-in devices could not load", { exact: true })).toBeVisible();
  await expect(page.getByText("No signed-in device is recorded", { exact: true })).toHaveCount(0);
  await page.getByRole("tab",{name:"Account activity",exact:true}).click();
  await expect(page.getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
  await context.close();
});

test("Stage 10 Family G7 keeps an activity read failure distinct from a truthful empty audit trail", async ({ browser }) => {
  const { context, page } = await openHub(browser, roles[0], { width: 390, height: 844 });
  await page.route("**/rest/v1/rpc/my_account_activity", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture account activity read failed" }),
    });
  });

  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();
  await page.getByRole("tab",{name:"Account activity",exact:true}).click();
  await expect(page.getByText("Recent account activity could not load", { exact: true })).toBeVisible();
  await expect(page.getByText("Nothing recorded yet", { exact: true })).toHaveCount(0);
  await page.getByRole("tab",{name:"Sessions",exact:true}).click();
  await expect(page.getByRole("heading", { name: "Signed in devices", exact: true })).toBeVisible();
  await context.close();
});


for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family G7 Your account composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[0], { width: viewport.width, height: viewport.height });
    await page.goto("/?tab=account");

    await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();
    await expect(page.getByText("Your account only", { exact: true })).toBeVisible();
    await expect(page.getByText(/Only you can see this/i)).toBeVisible();
    await page.getByRole("tab",{name:"Sessions",exact:true}).click();
    await expect(page.getByRole("button", { name: "Sign out on this device", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out on every device", exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Your account overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10g7-account-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("Stage 10 Family H1 keeps Control Center capability-filtered while aligning shared V2 primitives", async () => {
  const control = readFileSync("src/screens/ControlCenter.jsx", "utf8");
  expect(control).toContain('caps.has("authority.manage")');
  expect(control).toContain('caps.has("audit.view")');
  expect(control).toContain('caps.has("integration.manage")');
  expect(control).toContain('caps.has("payroll.prepare")');
  expect(control).toContain('caps.has("payroll.approve")');
  expect(control).toContain('caps.has("hr_private.access")');
  expect(control).toContain('supabase.from("leave_policy_versions")');
  expect(control).toContain('supabase.from("integration_connectors")');
  for(const label of ["Departments & reporting","Attendance & locations","Leave rules","Access permissions","Organisation rules","Alerts & reminders","Connected apps","Activity history"]) expect(control).toContain(label);
  expect(control).toContain("Set up how CEAC works.");
  expect(control).not.toMatch(/numeric health score|overall health score/i);
  expect(control).toContain("control-setting-row");
  expect(control).toContain("control-related-work");

});


test("OCR5F Administration system surfaces use shared Queue Record Settings and Composer archetypes", async () => {
  const lifecycle = readFileSync("src/screens/AdminLifecycle.jsx", "utf8");
  const workflows = readFileSync("src/screens/AdminWorkflows.jsx", "utf8");
  const authority = readFileSync("src/screens/AdminAuthority.jsx", "utf8");
  const policies = readFileSync("src/screens/AdminPolicies.jsx", "utf8");

  for (const source of [lifecycle, workflows, authority, policies]) expect(source).toContain("DataPanel");
  expect(lifecycle).toContain("ComposerDrawer");
  expect(lifecycle).toContain('title="Lifecycle cases"');
  expect(lifecycle).toContain('title="Case detail"');

  expect(workflows).toContain("SegmentedControl");
  expect(workflows).toContain('title="Waiting for a decision"');
  expect(workflows).toContain('title="Check"');
  expect(workflows).not.toContain('import { QueueRow, byOldest } from "../components/primitives"');

  expect(authority).toContain("RecordRow");
  expect(authority).toContain("ComposerDrawer");
  expect(authority).toContain("Show permission history");
  expect(authority).toContain('title="Active permissions"');

  expect(policies).toContain("ComposerDrawer");
  expect(policies).toContain("Show version history");
  expect(policies).toContain('title="Choose a rule"');
  expect(policies).toContain('title="Record new policy version"');
});

test("Stage 10 Family H2 keeps Organisation settings factual and persistence-backed", async () => {
  const settings = readFileSync("src/screens/OfficeSettings.jsx", "utf8");
  expect(settings).toContain('supabase.from("office_locations")');
  expect(settings).toContain('supabase.from("leave_policy_versions")');
  expect(settings).toContain('supabase.from("thresholds")');
  expect(settings).not.toContain('supabase.from("pending_invitations")');
  expect(settings).toContain("Confirm CEAC’s leave rules before assigning entitlements.");
  expect(settings).toContain("Leave policy not configured");
  expect(settings).toContain("does not change the underlying work or create a score");
  expect(settings).toContain("ev2-office-settings");
  expect(settings).toContain('.select("id,name,lat,lng,radius_meters").single()');
});


test("Stage 10 Family H3 keeps Executive directory records read-only with authorised assignment navigation", async () => {
  const organisation = readFileSync("src/screens/ExecutiveOrganisation.jsx", "utf8");
  expect(organisation).toContain('supabase.from("units")');
  expect(organisation).toContain('supabase.from("unit_memberships")');
  expect(organisation).toContain("Explore departments, teams and people, then open the work behind them.");
  expect(organisation).toContain("goAssign?.");
  expect(organisation).toContain("openRoom?.");
  expect(organisation).toContain("Needs attention");
  expect(organisation).toContain("leadership gap");
  expect(organisation).not.toContain(".insert(");
  expect(organisation).not.toContain(".update(");
  expect(organisation).not.toContain(".delete(");
  expect(organisation).not.toContain("supabase.rpc(");
});


test("Stage 10 Family H4 keeps Units evidence-backed and Administration-owned", async () => {
  const units = readFileSync("src/screens/Units.jsx", "utf8");
  expect(units).toContain('supabase.from("units")');
  expect(units).toContain('supabase.rpc("assign_unit_head"');
  expect(units).toContain("Session and leave facts are context only. They do not measure output.");
  expect(units).toContain("Currencies remain separate; CEAC OS does not invent exchange rates.");
  expect(units).toContain("Administration can inspect the record but does not enter the Manager’s review queue.");
  expect(units).toContain("Unit Head needed");
  expect(units).toContain("StatusBadge");
});


for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family H Administration Control Center composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[2], { width: viewport.width, height: viewport.height });
    await page.goto("/?tab=settings");
    await expect(page.getByRole("heading", { name: "Control Center", exact: true })).toBeVisible();
    await expect(page.getByText("Set up how CEAC works.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button",{name:/^Departments & reporting/})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Control Center overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10h-control-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family H Executive Organisation composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[3], { width: viewport.width, height: viewport.height });
    await page.goto("/?tab=exec-organisation");
    await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible();
    await expect(page.getByText(/Explore departments, teams and people/i)).toBeVisible();
    await expect(page.getByText(/Department heads recorded|leadership gap/i).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Executive Organisation overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10h-exec-org-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family H Administration Organisation settings composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[2], { width: viewport.width, height: viewport.height });
    await page.goto("/?tab=office-settings");
    await expect(page.getByRole("heading", { name: "Attendance & locations", exact: true })).toBeVisible();
    await expect(page.getByRole("button", {name:/^Office location/})).toBeVisible();
    await expect(page.getByRole("button", {name:/^Duty locations/})).toBeVisible();
    await expect(page.getByRole("button", {name:/^Check-in codes/})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Organisation settings overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10h-org-settings-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family H Administration Units composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openHub(browser, roles[2], { width: viewport.width, height: viewport.height });
    await page.goto("/?tab=units");
    await expect(page.getByRole("heading", { name: "Units", exact: true })).toBeVisible();
    await expect(page.getByText(/without creating a second reporting system/i)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Administration Units overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10h-units-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("Stage 10 Family H Administration cannot be reached from ordinary Staff or Manager roles", async ({ browser }) => {
  for (const role of [roles[0], roles[1]]) {
    const { context, page } = await openHub(browser, role, { width: 390, height: 844 });
    await page.goto("/?tab=settings");
    await expect(page.getByRole("heading", { name: "Control Center", exact: true })).toHaveCount(0);
    await page.goto("/?tab=units");
    await expect(page.getByRole("heading", { name: "Units", exact: true })).toHaveCount(0);
    await page.goto("/?tab=office-settings");
    await expect(page.getByRole("heading", { name: "Attendance & locations", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 10 Family H Executive Organisation stays Executive-only", async ({ browser }) => {
  for (const role of [roles[0], roles[1], roles[2]]) {
    const { context, page } = await openHub(browser, role, { width: 390, height: 844 });
    await page.goto("/?tab=exec-organisation");
    await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toHaveCount(0);
    await context.close();
  }
});
