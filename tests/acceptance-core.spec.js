// FPG10 exact-head Level B whole-system parity propagation checkpoint.
// FPG9 final exact-head Level B Home shell parity checkpoint — route-lazy cascade + locked budget.
// FPG8 exact-head Level B staff reconciliation safety checkpoint.
// FPG7 exact-head Level B People Workforce parity checkpoint — final 12px repair.
// FPG7 exact-head Level B People Workforce parity checkpoint — CSS budget repair.
// FPG2/FPG3 exact-head Level B parity evidence checkpoint.
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;

// Keep execution ordered (fullyParallel=false, one worker in CI), but report
// every independent acceptance failure instead of skipping the remaining file.
test.describe.configure({ mode: "default" });

test("Authentication shell matches the PWA responsive contract", async ({ browser }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByPlaceholder("Work email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (viewport.width >= 901) {
      await expect(page.getByText("Know what matters.")).toBeVisible();
      await expect(page.getByText("Today", { exact: true })).toBeVisible();
      await expect(page.getByText("Pulse", { exact: true })).toBeVisible();
      await expect(page.getByText("Insight", { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("CEAC OS", { exact: true }).first()).toBeVisible();
    }
    await context.close();
  }
});

async function waitForRouteReady(page) {
  await expect(page.locator(".route-fallback")).toHaveCount(0, { timeout: 15000 });
}

async function openAs(browser, email, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({
    viewport,
    geolocation: { latitude: 5.6037, longitude: -0.1870 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await waitForRouteReady(page);
  return { context, page };
}

const routeByLabel = {
  Home:"home", Work:"work", Team:"team", Me:"me", Record:"record",
  Strategy:"strategy", Delivery:"delivery", Workload:"workload",
  "Assets & devices":"assets", Assets:"assets", Compliance:"compliance",
  "Performance & development":"performance", Learning:"learning",
  Workforce:"attendance", "Time & Leave":"attendance",
  People:"people", "People & Access":"people", "Employee lifecycle":"lifecycle", "Protected HR":"protected-hr",
  Units:"units", Projects:"admin-projects", Calendar:"admin-calendar",
  Reports:"reporting", Cost:"cost", Finance:"finance", Payroll:"payroll",
  Audit:"audit", Events:"events", Workflows:"workflows", Checks:"workflows", Authority:"authority",
  "System rules":"policies", Integrations:"integrations", "Connected Apps":"integrations", "Control Center":"settings", Settings:"settings",
  Announcements:"announcements"
};

async function go(page, name) {
  const visibleNav = page.locator(".ev2s-sidebar").getByRole("button", { name, exact: true });
  if (await visibleNav.count()) {
    await visibleNav.click();
    await waitForRouteReady(page);
    await expect(page.locator(".body")).toBeVisible({ timeout: 15000 });
    return;
  }

  let route = routeByLabel[name];
  const isManagerSurface = await page.locator(".manager-app").count();
  const isAdminSurface = await page.locator(".office-app").count();
  if (name === "Projects") route = isAdminSurface ? "admin-projects" : "projects";
  if (name === "Calendar") route = isAdminSurface ? "admin-calendar" : "calendar";
  if (name === "Finance") route = isManagerSurface ? "manager-finance" : "finance";
  if (name === "Reports") route = isManagerSurface ? "manager-reports" : "reporting";
  if (!route) throw new Error(`No acceptance route mapping for ${name}`);
  const target = route === "home" ? "/" : `/?tab=${route}`;
  await page.goto(target);
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await waitForRouteReady(page);
  // Lazy destinations may mount after the fallback briefly disappears. The
  // next layout measurement must examine the actual authorised route body.
  await expect(page.locator(".app-content .body").first()).toBeVisible({ timeout:15000 });
}

async function assignTask(page, title, step = null) {
  await page.getByRole("button", { name: "New work", exact: true }).first().click();
  await page.getByLabel("Work to complete").fill(title);
  await page.getByLabel("Why this matters").fill("Acceptance test purpose");
  await page.getByText("Finished result", { exact: false }).filter({ hasText: "optional" }).first().click();
  await page.getByLabel("Finished result").fill("Acceptance test finished result");
  await page.getByText("Subtasks", { exact: true }).first().click();
  if (step) await page.getByPlaceholder("Step 1").fill(step);
  else await page.getByLabel(/No steps needed/).check();
  const assignee = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Staff Fixture" }) });
  await assignee.selectOption({ label: "Staff Fixture" });
  const due = new Date(Date.now() + 2 * 86400000);
  const dueLocal = due.toISOString().slice(0, 16);
  await page.locator('input[type="datetime-local"]').last().fill(dueLocal);
  await page.getByRole("button", { name: "Give it out" }).click();
  await expect(page.getByText(/is with them/)).toBeVisible();
}


async function openCompleteWorkRecord(page, title) {
  // The owner-approved Work surface is a responsibility register + inspector,
  // not the retired ev2w-row click-to-detail layout. Search by the exact
  // authored title so register grouping and pagination cannot hide it.
  const finder=page.getByPlaceholder("Find a task, project or reference…").first();
  await expect(finder).toBeVisible({timeout:20000});
  await finder.fill(title);
  const row=page.locator(".s2-register-row").filter({hasText:title}).first();
  await expect(row).toBeVisible({timeout:20000});
  await row.getByRole("button").first().click();
  const inspector=page.getByRole("complementary",{name:"Selected responsibility"});
  await expect(inspector.getByRole("heading",{name:title})).toBeVisible({timeout:20000});
  await inspector.getByRole("button",{name:/Open full work record/}).click();
  await expect(page.locator(".ev2-work-detail")).toBeVisible({timeout:20000});
}

test("Staff and Manager complete the real work loop, including return and approval", async ({ browser }) => {
  test.setTimeout(60_000);
  const title = "Acceptance task — review loop";
  const step = "Acceptance step one";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await assignTask(page, title, step);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");

    await page.getByRole("button", { name: "Start work", exact: true }).click();
    const startDialog = page.getByRole("dialog");
    await expect(startDialog).toBeFocused();
    await startDialog.getByRole("radio", { name: "CEAC location", exact: true }).check();
    await startDialog.getByRole("combobox", { name: "Authorised duty location" }).selectOption({ label: "Acceptance office" });
    await startDialog.getByRole("button", { name: "Start work", exact: true }).click();
    await expect(page.getByRole("button", { name: "End work" })).toBeVisible();

    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await expect(page.getByText("Why this matters")).toBeVisible();
    await expect(page.getByText("What finished looks like")).toBeVisible();
    await page.getByRole("button", { name: new RegExp(step) }).click();
    await page.getByRole("button", { name: "Send for review" }).click();
    const sendDialog = page.getByRole("dialog");
    await sendDialog.getByPlaceholder("Anything they should know (optional)").fill("First submission");
    await sendDialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent in")).toBeVisible();

    await page.getByRole("button", { name: "← Back" }).click();
    await go(page, "Home");
    await page.getByRole("button", { name: "End work" }).click();
    await expect(page.getByRole("button", { name: "Start work", exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await go(page, "Work");
    await page.getByRole("tab", { name: /For review/ }).click();
    const reviewRow = page.locator(".ev2w-review-row").filter({ hasText: title }).first();
    await expect(reviewRow).toBeVisible();
    await reviewRow.click();
    await expect(page.getByText("Review submitted work", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Return for correction", exact: true }).click();
    const returnDialog = page.getByRole("dialog");
    const redo = returnDialog.getByRole("button", { name: new RegExp(step) });
    if (await redo.count()) await redo.click();
    await returnDialog.getByPlaceholder("Explain exactly what needs changing").fill("Please correct the acceptance item.");
    await returnDialog.getByRole("button", { name: "Return work", exact: true }).click();
    await go(page, "Work");
    await page.getByRole("tab", { name: /For review/ }).click();
    await expect(page.locator(".ev2w-review-row").filter({ hasText: title })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await expect(page.getByText("Sent back by your manager")).toBeVisible();
    await expect(page.getByText("Please correct the acceptance item.")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r7-stage10a3-returned-work.png", fullPage: true });

    const check = page.getByRole("button", { name: new RegExp(step) });
    const klass = await check.getAttribute("class");
    if (!String(klass).includes("done")) {
      await page.getByRole("button", { name: "← Back" }).click();
      await go(page, "Home");
      await page.getByRole("button", { name: "Start work", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: "CEAC location", exact: true }).check();
      await dialog.getByRole("combobox", { name: "Authorised duty location" }).selectOption({ label: "Acceptance office" });
      await dialog.getByRole("button", { name: "Start work", exact: true }).click();
      await expect(page.getByRole("button", { name: "End work" })).toBeVisible();
      await go(page, "Work");
      await openCompleteWorkRecord(page, title);
      await page.getByRole("button", { name: new RegExp(step) }).click();
    }

    await page.getByRole("button", { name: "Send for review" }).click();
    const resubmitDialog = page.getByRole("dialog");
    const send = resubmitDialog.getByRole("button", { name: /^(Send|Send outside session)$/ });
    await send.click();
    await expect(page.getByText("Sent in")).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await go(page, "Work");
    await page.getByRole("tab", { name: /For review/ }).click();
    const reviewRow = page.locator(".ev2w-review-row").filter({ hasText: title });
    await expect(reviewRow).toBeVisible();
    await reviewRow.click();
    await expect(page.locator(".ev2-work-detail")).toBeVisible();
    await expect(page.getByText("Review submitted work", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const approveDialog = page.getByRole("dialog");
    await approveDialog.getByRole("button", { name: "Confirm approval", exact: true }).click();
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Me");
    await page.getByRole("button", { name: /My work history/ }).click();
    await expect(page.getByRole("heading", { name: "My work history" })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await go(page, "Home");
    const endWork = page.getByRole("button", { name: "End work" });
    if (await endWork.count()) await endWork.click();
    await context.close();
  }
});

test("A blocker can be raised, acknowledged by the manager, and resolved", async ({ browser }) => {
  const title = "Acceptance task — blocker";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await assignTask(page, title);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await expect(page.getByRole("button", { name: "Start work", exact: true })).toBeVisible();

    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    const waitingAction = page.getByRole("button", { name: "I am waiting on someone" });
    await expect(waitingAction).toBeEnabled();
    await waitingAction.click();
    const blockerDialog = page.getByRole("dialog");
    await blockerDialog.getByPlaceholder("What you need, and from whom").fill("Manager confirmation");
    await blockerDialog.getByRole("button", { name: "Test Unit A" }).click();
    await blockerDialog.getByRole("button", { name: "Mark as waiting" }).click();
    await expect(page.getByText(/Waiting on Test Unit A/)).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r7-stage10a3-dependency-work.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    const blockerRow = page.locator(".managerv2-decision-row").filter({ hasText: title });
    await expect(blockerRow).toBeVisible();
    await blockerRow.getByRole("button", { name: "Acknowledge" }).click();
    const acknowledgedRow = page.locator(".managerv2-dependency-row").filter({ hasText: title });
    await expect(acknowledgedRow).toBeVisible();
    await expect(acknowledgedRow).toContainText("Acknowledged");
    await acknowledgedRow.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.locator(".managerv2-dependency-row").filter({ hasText: title })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await expect(page.getByText(/Waiting on Test Unit A/)).toHaveCount(0);
    await page.getByRole("button", { name: "← Back" }).click();
    await go(page, "Home");
    await context.close();
  }
});

test("Nested Work navigation survives refresh and browser Back", async ({ browser }) => {
  const title = "Acceptance task — deep link";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await assignTask(page, title);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await expect(page).toHaveURL(/(?:\?|&)item=/);
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/(?:\?|&)item=/);

    await page.goBack();
    await expect(page).toHaveURL(/(?:\?|&)tab=work/);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await context.close();
  }
});

test("Staff personal details persist and private work stays out of another staff account", async ({ browser }) => {
  const privateTitle = "Private acceptance work";

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Me");
    await page.getByRole("tab", { name: "Personal" }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Preferred name").fill("Staff Preferred");
    await dialog.getByLabel("Phone", { exact: true }).fill("+233200000001");
    await dialog.getByPlaceholder("Contact name").fill("Emergency Fixture");
    await dialog.getByLabel("Address or ordinary contact information").fill("Fixture address");
    await dialog.getByRole("button", { name: "Save personal details" }).click();
    await expect(dialog.getByRole("button", { name: "Save personal details" })).toBeEnabled();
    await dialog.locator(".ev2c-overlay-head").getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Edit" }).click();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByLabel("Preferred name")).toHaveValue("Staff Preferred");
    await expect(reopened.getByPlaceholder("Contact name")).toHaveValue("Emergency Fixture");
    await expect(reopened.getByLabel("Address or ordinary contact information")).toHaveValue("Fixture address");
    await reopened.locator(".ev2c-overlay-head").getByRole("button", { name: "Close", exact: true }).click();

    await go(page, "Work");
    await page.getByRole("button", { name: "Add private work" }).click();
    const privateDialog = page.getByRole("dialog");
    await privateDialog.getByPlaceholder("What are you doing?").fill(privateTitle);
    await privateDialog.getByPlaceholder("What should be true when this is finished?").fill("Private acceptance outcome");
    await privateDialog.getByLabel(/No steps needed/).check();
    await privateDialog.getByRole("button", { name: "Add private work" }).click();
    await expect(page.getByText(/added as private work/)).toBeVisible();
    await expect(page.getByRole("heading", { name: privateTitle, exact: true })).toBeVisible({ timeout: 15000 });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "other@ceac.local.test");
    await go(page, "Work");
    await expect(page.getByText(privateTitle, { exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Assistive voice controls are real interaction affordances and proposals require review", async ({ browser }) => {
  const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
  await page.locator(".fpg9-mobile-shortcuts").getByRole("button", { name: "Work", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Give out work", exact: true }).click();
  const mic = page.getByRole("button", { name: "Speak your instruction" });
  await expect(mic).toBeVisible();
  await expect(page.getByText("Apply proposal", { exact: true })).toHaveCount(0);
  await context.close();
});

test("OCR6C work source attachment reaches the authorised Staff record", async ({ browser }) => {
  const title = "OCR6 source-file assignment";
  const filename = "ocr6-work-source.txt";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await page.getByRole("button", { name: "Give out work", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Give out work" })).toBeVisible();
    await page.getByLabel("Work to complete").fill(title);
    await page.getByLabel("Why this matters").fill("Prove private source-file assignment end to end.");
    const assignee = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Staff Fixture" }) });
    await assignee.selectOption({ label: "Staff Fixture" });
    await page.locator('input[type="datetime-local"]').last().fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0,16));
    await page.getByText("Attachments", { exact: true }).first().click();
    await page.locator('.operational-files-picker input[type="file"]').setInputFiles({
      name: filename,
      mimeType: "text/plain",
      buffer: Buffer.from("OCR6 private work source file"),
    });
    await page.getByRole("button", { name: "Give it out", exact: true }).click();
    await expect(page.getByText(/is with them/)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await expect(page.getByText("Source files", { exact: true })).toBeVisible();
    await expect(page.getByText(filename, { exact: true })).toBeVisible();
    await context.close();
  }
});

test("Typed work can be created and reaches the Staff work surface", async ({ browser }) => {
  const created = [
    { kind: "Routine", intent: "Set repeating work", title: "Acceptance routine", button: "Create routine" },
    { kind: "Case", intent: "Track an ongoing matter", title: "Acceptance case", button: "Open case" },
    { kind: "Request", intent: "Ask for something", title: "Acceptance request", button: "Send request" },
    { kind: "Decision", intent: "Get a decision", title: "Acceptance decision", button: "Ask for decision" },
    { kind: "Meeting outcome", intent: "Follow up from a meeting", title: "Acceptance meeting outcome", button: "Record meeting outcome" },
    { kind: "Deliverable", intent: "Get a finished output", title: "Acceptance deliverable", button: "Give deliverable" },
  ];

  const { context, page } = await openAs(browser, "manager@ceac.local.test");
  await page.getByRole("button", { name: "Give out work" }).click();

  for (const item of created) {
    await page.getByLabel("Work type").selectOption({ label: item.intent });

    if (item.kind === "Routine") {
      await page.getByLabel("Repeating responsibility").fill(item.title);
      // The owner-approved dated routine engine requires an explicit start
      // date. Do not bypass its fail-closed validation just to click Create.
      const start = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      await page.getByLabel("Starts", { exact: true }).fill(start);
    }
    if (item.kind === "Case") await page.getByLabel("Matter to track").fill(item.title);
    if (item.kind === "Request") await page.getByLabel("What you need").fill(item.title);
    if (item.kind === "Decision") {
      await page.getByLabel("Decision needed").fill(item.title);
      await page.getByLabel("Decision question").fill("Acceptance decision question");
    }
    if (item.kind === "Meeting outcome") {
      await page.getByLabel("Commitment agreed").fill(item.title);
      await page.getByLabel("Meeting title").fill("Acceptance meeting");
    }
    if (item.kind === "Deliverable") {
      await page.getByLabel("Output to produce").fill(item.title);
      await page.getByLabel("Finished output").fill("Acceptance finished deliverable");
    }

    if (item.kind === "Request") {
      const unitSelect = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Test Unit A" }) }).first();
      await unitSelect.selectOption({ label: "Test Unit A" });
    } else {
      const assignee = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Staff Fixture" }) });
      await assignee.selectOption({ label: "Staff Fixture" });
    }

    await page.getByRole("button", { name: item.button }).click();
    await expect(page.getByText(/is with them/)).toBeVisible();
    await page.getByRole("button", { name: "Give out something else" }).click();
  }

  await context.close();

  const staff = await openAs(browser, "staff@ceac.local.test");
  await go(staff.page, "Work");
  for (const item of created.filter((entry) => entry.kind !== "Request")) {
    // The real register is paginated. Find each newly authored responsibility
    // through its existing search before asserting the saved Staff row.
    await staff.page.getByRole("searchbox", { name: "Find a responsibility" }).fill(item.title);
    await expect(staff.page.locator(".s2-register-row").getByText(item.title, { exact: true })).toBeVisible();
  }
  await staff.context.close();
});

test("Recurring ministry numbers flow from a unit record to the Group Pastor overview", async ({ browser }) => {
  const numberName = "Acceptance first timers";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await go(page, "Reports");
    await expect(page.getByText("Recurring numbers", { exact: true })).toBeVisible();
    const card = page.locator(".admin-unit-summary").filter({ hasText: numberName });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Record" }).click();
    const recordDialog = page.getByRole("dialog");
    await recordDialog.locator('input[type="number"]').fill("17");
    await recordDialog.getByRole("button", { name: "Record number" }).click();
    await expect(page.getByText(`${numberName} recorded.`, { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test");
    await expect(page.getByRole("heading", { name: "Significant updates", exact: true })).toBeVisible();
    await expect(page.getByText(numberName, { exact: true })).toBeVisible();
    await expect(page.getByText(/17 People received/)).toBeVisible();
    await context.close();
  }
});

test("Experience Stage 8 removes the known navigation, Team and Calendar defects", async ({ browser }) => {
  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    const side = page.locator(".ev2s-sidebar");
    await expect(side.getByRole("button", { name: "Finance", exact: true })).toBeVisible();
    await expect(side.getByRole("button", { name: "Budget", exact: true })).toHaveCount(0);
    await expect(side.getByRole("button", { name: "Messages", exact: true })).toBeVisible();
    await expect(side.getByRole("button", { name: "My Hub", exact: true })).toBeVisible();

    await go(page, "Team");
    await expect(page.locator(".ev2-people-page.ev2-people-manager")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await expect(page.locator(".ev2p-section-head").getByText("People & volunteers",{exact:true})).toBeVisible();
    const peopleSection = page.locator(".ev2p-section").filter({ hasText: /^People/ }).first();
    const setupHeading = page.getByRole("heading", { name: "Team setup", exact: true });
    await expect(peopleSection).toBeVisible();
    await expect(setupHeading).toBeVisible();
    const [peopleBox, setupBox] = await Promise.all([peopleSection.boundingBox(), setupHeading.boundingBox()]);
    expect(peopleBox?.y || 0).toBeLessThan(setupBox?.y || Number.POSITIVE_INFINITY);
    await expect(page.getByRole("button", { name: "Assign work to this part", exact: true }).first()).toBeVisible();

    await go(page, "Calendar");
    await expect(page.getByText("Your Google Calendar", { exact: true })).toBeVisible();
    await expect(page.getByText(/Automatic personal sync is not connected yet/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Google Calendar", exact: true })).toBeVisible();

    await side.getByRole("button", { name: "My Hub", exact: true }).click();
    await expect(page.locator(".body")).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Control Center");
    await expect(page.getByRole("button", { name: "Pending decisions", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pending decisions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pending decisions", exact: true })).toBeVisible();
    await expect(page.getByText("Waiting for a decision", { exact: true })).toBeVisible();
    await context.close();
  }
});

test("Mobile Staff and desktop Admin/Executive surfaces render without obvious regression", async ({ browser }) => {
  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
    const activeEnd = page.getByRole("button", { name: "End work" });
    if (await activeEnd.count()) await activeEnd.click();
    await page.getByRole("button", { name: "Start work", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test");
    for (const destination of ["Units", "People", "Workforce", "Cost", "Reports", "Settings"]) {
      await go(page, destination);
      await expect(page.locator(".body")).toBeVisible();
      await expect(page.locator(".flag-brick")).toHaveCount(0);
    }
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test");
    await expect(page.locator(".body")).toBeVisible();
    await go(page, "Announcements");
    await expect(page.locator(".body")).toBeVisible();
    await go(page, "Me");
    await expect(page.locator(".body")).toBeVisible();
    await context.close();
  }
});


test("Staff PWA layout has no page-level horizontal overflow at supported phone widths", async ({ browser }) => {
  test.setTimeout(90000);
  const widths = [320, 360, 375, 390, 414, 430];
  const destinations = ["Home", "Work", "Team", "Me"];

  for (const width of widths) {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width, height: 844 });
    for (const destination of destinations) {
      await go(page, destination);
      await expect(page.locator(".body")).toBeVisible();
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      }));
      expect(overflow.document, `${destination} overflowed the ${width}px viewport`).toBeLessThanOrEqual(1);
      expect(overflow.body, `${destination} body overflowed the ${width}px viewport`).toBeLessThanOrEqual(1);

      if (destination === "Me") {
        await page.getByRole("button", { name: /My work history/ }).click();
        await expect(page.getByRole("heading", { name: "My work history" })).toBeVisible();
        const historyOverflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(historyOverflow.document, `My work history overflowed the ${width}px viewport`).toBeLessThanOrEqual(1);
        expect(historyOverflow.body, `My work history body overflowed the ${width}px viewport`).toBeLessThanOrEqual(1);
      }
    }
    await context.close();
  }
});


test("OCR6C Unit Rooms carry attributable communication and private media between Manager and Staff", async ({ browser }) => {
  const message = "Room acceptance — confirm Sunday setup";
  const filename = "ocr6-room-media.png";
  const media = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlSIAAAAASUVORK5CYII=", "base64");

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    await expect(page).toHaveURL(/roomKind=unit/);
    await expect(page.getByRole("heading", { name: "Test Unit A" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Test Unit A" })).toBeVisible();
    const chooseFile = page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Attach file',exact:true}).click();
    await (await chooseFile).setFiles({ name: filename, mimeType: "image/png", buffer: media });
    await page.getByPlaceholder("Message your unit").fill(message);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    // Distinguish an upload or registration failure from a private signed-URL/render failure.
    // Both conditions are mandatory; never treat message delivery alone as media success.
    await expect(page.locator(".room-error")).toHaveCount(0);
    await expect(page.getByRole("img", { name: filename })).toBeVisible({ timeout: 15000 });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: filename })).toBeVisible({ timeout: 15000 });
    await context.close();
  }
});

test("Rooms 2.0 resolves real mentions and supports Sub-team context without DMs", async ({ browser }) => {
  const message = "Please confirm the camera setup";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();

    await expect(page.getByRole("button", { name: "Fixture Video Team", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fixture Video Team", exact: true }).click();
    await expect(page).toHaveURL(/roomKind=sub_team/);
    await expect(page.getByText("Sub-team Room", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Sub-team Room", { exact: true })).toBeVisible();

    const composer = page.getByPlaceholder("Message Fixture Video Team");
    await composer.fill("@Sta");
    await expect(page.getByRole("button", { name: /Staff Fixture/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Staff Fixture/ }).click();
    await composer.fill((await composer.inputValue()) + message);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Staff Fixture.*Please confirm the camera setup/)).toBeVisible();

    await page.getByRole("button", { name: "Add context or action" }).click();
    await expect(page.getByText("Schedule meeting", { exact: true })).toBeVisible();
    await expect(page.getByText("Direct message", { exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "sameunit@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    await expect(page.getByRole("button", { name: "Fixture Video Team", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("A Manager can schedule a Unit meeting with an explicit audience and Staff can open it", async ({ browser }) => {
  const title = "Acceptance unit meeting";
  const tomorrow = new Date(Date.now() + 86400000);
  const pad = (value) => String(value).padStart(2, "0");
  const localValue = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T10:30`;

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Calendar");

    await expect(page.getByRole("tab", { name: "Month", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Week", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /View All/ })).toBeVisible();
    await page.getByRole("button", { name: /View All/ }).click();
    const filterDialog = page.getByRole("dialog");
    await filterDialog.getByRole("tab", { name: "Meetings", exact: true }).click();

    await page.getByRole("button", { name: "Schedule meeting" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('option[value="google_meet"]')).toHaveText("Google Meet");
    await dialog.getByPlaceholder("What is this meeting for?").fill(title);
    await dialog.locator('input[type="datetime-local"]').first().fill(localValue);
    await dialog.getByPlaceholder("Join link (optional)").fill("https://zoom.us/j/123456789");
    await dialog.getByPlaceholder("What should this meeting cover?").fill("Review current work and record actions.");

    const unitAudience = dialog.getByRole("button", { name: /Everyone in this unit/ });
    if (!(await unitAudience.getAttribute("class") || "").includes("on")) await unitAudience.click();

    await dialog.getByRole("button", { name: "Schedule and notify" }).click();
    await expect(page).toHaveURL(/(?:\?|&)meeting=/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: /Join Zoom/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open meeting discussion", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    const meetingRow = page.locator(".staffv2").getByRole("button").filter({ hasText: title });
    await expect(meetingRow).toHaveCount(1);
    await expect(meetingRow).toBeVisible();
    await meetingRow.click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meeting workspace" })).toBeVisible();
    await expect(page.getByText("Notes open when the meeting starts", { exact: true })).toBeVisible();
    await expect(page.getByText("My notes", { exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Administration can combine multiple units into one meeting audience", async ({ browser }) => {
  const title = "Acceptance multi-unit meeting";
  const tomorrow = new Date(Date.now() + 2 * 86400000);
  const pad = (value) => String(value).padStart(2, "0");
  const localValue = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T09:00`;

  const { context, page } = await openAs(browser, "admin@ceac.local.test");
  await go(page, "Home");
  await page.getByRole("complementary", { name: "Upcoming commitments" })
    .getByRole("button", { name: "Schedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("What is this meeting for?").fill(title);
  await dialog.locator('input[type="datetime-local"]').first().fill(localValue);

  await dialog.getByRole("button", { name: /Test Unit A/ }).click();
  await dialog.getByRole("button", { name: /Test Unit B/ }).click();
  await expect(dialog.getByText(/participant/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Schedule and notify" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(/participant/).first()).toBeVisible();
  await context.close();
});

test("Manager primary surfaces stay usable across supported phone widths", async ({ browser }) => {
  test.setTimeout(120000);
  const widths = [320, 360, 375, 390, 414, 430];
  // Manager mobile acceptance must exercise the routes the Manager is
  // actually authorised to visit; admin/Executive-only destinations stay denied.
  const destinations = ["Home", "Work", "Team", "Projects", "Time & Leave", "Calendar", "Finance", "Reports"];

  for (const width of widths) {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width, height: 844 });
    for (const destination of destinations) {
      await go(page, destination);
      await expect(page.locator(".body")).toBeVisible();
      // Navigation transitions can briefly unmount the prior route.
      // Assert the final page width (not a vanished intermediate element)
      // while preserving the original >250px and overflow requirements.
      await expect.poll(() => page.evaluate(() =>
        document.querySelector(".app-content .body")?.getBoundingClientRect().width || 0
      ), { message: `Manager / ${destination} collapsed at ${width}px`, timeout: 15000 }).toBeGreaterThan(250);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `Manager / ${destination} overflowed at ${width}px`).toBeLessThanOrEqual(1);
    }
    await context.close();
  }
});

test("Goals and Strategy preserves factual hierarchy and manager authority", async ({ browser }) => {
  test.setTimeout(120000);

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Strategy");
    await expect(page.getByRole("heading", { name: "Strategy", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add Ministry Direction", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Strategy name").fill("Acceptance ministry direction");
    await dialog.getByLabel("Strategy statement").fill("Build reliable ministry systems while reaching and serving people.");
    await dialog.getByLabel("Strategy change reason").fill("Acceptance Stage 4 direction");
    await dialog.getByRole("button", { name: "Create ministry direction", exact: true }).click();
    await expect(page.getByText("Strategy record created.", { exact: true })).toBeVisible();

    const direction = page.locator("section.card").filter({ hasText: "Acceptance ministry direction" });
    await expect(direction).toBeVisible();
    await direction.getByRole("button", { name: "Add Ministry Objective", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Strategy name").fill("Acceptance ministry objective");
    await dialog.getByLabel("Strategy statement").fill("Make weekly ministry delivery more reliable across participating units.");
    await dialog.getByText(/Reason \/ context/).first().click();
    await dialog.getByLabel("Strategy change reason").fill("Acceptance Stage 4 ministry objective");
    await dialog.getByRole("button", { name: "Create ministry objective", exact: true }).click();

    await page.getByRole("button", { name: "Add Unit Objective", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Strategy unit").selectOption("20000000-0000-4000-8000-000000000011");
    await dialog.getByLabel("Strategy name").fill("Acceptance Unit A objective");
    await dialog.getByLabel("Strategy statement").fill("Record completed readiness outcomes for the agreed weekly schedule.");
    await dialog.getByRole("button", { name: "Add measure, dates or status", exact: true }).click();
    await dialog.getByLabel("Strategy measurement").selectOption("numeric");
    await dialog.getByLabel("Strategy measure label").fill("Completed readiness outcomes");
    await dialog.getByLabel("Strategy target value").fill("12");
    await dialog.getByLabel("Strategy target unit").fill("outcomes");
    await dialog.getByLabel("Strategy current value").fill("3");
    await dialog.getByLabel("Strategy change reason").fill("Acceptance Stage 4 unit objective");
    await dialog.getByRole("button", { name: "Create unit objective", exact: true }).click();

    await expect(page.getByText(/current 3 outcomes · target 12 outcomes/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Acceptance ministry direction", { exact: true })).toBeVisible();
    await expect(page.getByText(/Acceptance Unit A objective/)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Strategy");
    const unitObjective = page.locator(".row").filter({ hasText: "Acceptance Unit A objective" });
    await expect(unitObjective).toBeVisible();
    await unitObjective.getByRole("button", { name: "Revise", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Strategy current value").fill("5");
    await dialog.getByLabel("Strategy change reason").fill("Acceptance factual result update");
    await dialog.getByRole("button", { name: "Record revision", exact: true }).click();
    await expect(page.getByText(/current 5 outcomes · target 12 outcomes/)).toBeVisible();

    await unitObjective.getByRole("button", { name: "Link project", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Strategy delivery project").selectOption({ label: "Stage 4 Browser Project" });
    await dialog.getByLabel("Strategy delivery reason").fill("Acceptance project supports this Unit Objective");
    await dialog.getByRole("button", { name: "Link project", exact: true }).click();
    await expect(page.getByText("Stage 4 Browser Project", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(/current 5 outcomes · target 12 outcomes/)).toBeVisible();
    await expect(page.getByText("Stage 4 Browser Project", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Strategy");
    await expect(page.getByText("Acceptance ministry direction", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Ministry Direction", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Revise", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Link project", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 5 Delivery manages programmes, milestones, dependencies and project register without hidden scoring", async ({ browser }) => {
  test.setTimeout(150000);

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Delivery");
    await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "New Programme / Portfolio", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Delivery group name").fill("Acceptance Unit A Programme");
    await dialog.getByLabel("Delivery group purpose").fill("Coordinate the Stage 5 browser delivery journey.");
    await dialog.getByLabel("Delivery group reason").fill("Acceptance Stage 5 programme");
    await dialog.getByRole("button", { name: "Create Programme / Portfolio", exact: true }).click();
    await expect(page.getByText("Programme / Portfolio created.", { exact: true })).toBeVisible();
    await expect(page.locator(".row-t").filter({ hasText: /^Acceptance Unit A Programme$/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /Stage 4 Browser Project/ }).first().click();
    await page.getByLabel("Delivery project priority").selectOption("high");
    await page.getByLabel("Delivery project health").selectOption("watch");
    await page.getByLabel("Delivery metadata reason").fill("Acceptance explicit project health");
    await page.getByRole("button", { name: "Save project state", exact: true }).click();
    await expect(page.getByText("Project delivery metadata updated.", { exact: true })).toBeVisible();

    await page.getByLabel("Delivery group link", { exact: true }).selectOption({ label: "Acceptance Unit A Programme" });
    await page.getByLabel("Delivery group link reason").fill("Acceptance project belongs to programme");
    await page.getByRole("button", { name: "Link project", exact: true }).click();
    await expect(page.getByText("Project linked to Programme / Portfolio.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add milestone", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Milestone name").fill("Acceptance Foundation milestone");
    await dialog.getByLabel("Milestone description").fill("Foundation delivery checkpoint.");
    await dialog.getByLabel("Milestone status").selectOption("in_progress");
    await dialog.getByLabel("Milestone reason").fill("Acceptance first milestone");
    await dialog.getByRole("button", { name: "Save milestone", exact: true }).click();
    await expect(page.getByText("Milestone recorded.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add milestone", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Milestone name").fill("Acceptance Launch milestone");
    await dialog.getByLabel("Milestone description").fill("Launch delivery checkpoint.");
    await dialog.getByLabel("Milestone reason").fill("Acceptance second milestone");
    await dialog.getByRole("button", { name: "Save milestone", exact: true }).click();

    const foundation = page.locator(".row").filter({ hasText: "Acceptance Foundation milestone" });
    await foundation.getByRole("button", { name: "Revise", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Milestone status").selectOption("achieved");
    await dialog.getByLabel("Milestone reason").fill("Acceptance foundation achieved");
    await dialog.getByRole("button", { name: "Record milestone revision", exact: true }).click();
    await expect(page.getByText("Milestone revised.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add risk", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register item title").fill("Acceptance dependency risk");
    await dialog.getByLabel("Register item description").fill("A predecessor delay could affect launch.");
    await dialog.getByLabel("Register item severity").selectOption("high");
    await dialog.getByLabel("Register item likelihood").selectOption("medium");
    await dialog.getByLabel("Register item response plan").fill("Review predecessor movement weekly.");
    await dialog.getByLabel("Register item reason").fill("Acceptance Stage 5 risk");
    await dialog.getByRole("button", { name: "Save risk", exact: true }).click();
    await expect(page.getByText("Risk recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Project dependency predecessor").selectOption({ label: "Stage 5 Dependency Project" });
    await page.getByLabel("Project dependency reason").fill("Acceptance project dependency");
    await page.getByRole("button", { name: "Add project dependency", exact: true }).click();
    await expect(page.getByText("Project dependency recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Milestone dependency successor").selectOption({ label: "Acceptance Launch milestone" });
    await page.getByLabel("Milestone dependency predecessor").selectOption({ label: "Acceptance Foundation milestone" });
    await page.getByLabel("Milestone dependency reason").fill("Acceptance milestone dependency");
    await page.getByRole("button", { name: "Add milestone dependency", exact: true }).click();
    await expect(page.getByText("Milestone dependency recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Work dependency successor").selectOption("26000000-0000-4000-8000-000000000012");
    await page.getByLabel("Work dependency predecessor").selectOption("26000000-0000-4000-8000-000000000011");
    await page.getByLabel("Work dependency reason").fill("Acceptance work dependency");
    await page.getByRole("button", { name: "Add work dependency", exact: true }).click();
    await expect(page.getByText("Work dependency recorded.", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();
    await expect(page.locator(".row-t").filter({ hasText: /^Acceptance Unit A Programme$/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Stage 4 Browser Project/ }).first().click();
    await expect(page.locator(".row-t").filter({ hasText: /^Acceptance Foundation milestone$/ }).first()).toBeVisible();
    await expect(page.getByText("Acceptance dependency risk", { exact: true })).toBeVisible();
    await expect(page.getByText(/Depends on Stage 5 Dependency Project/)).toBeVisible();
    await expect(page.getByText(/Acceptance Launch milestone depends on Acceptance Foundation milestone/)).toBeVisible();
    await expect(page.getByText(/Stage 5 dependent work depends on Stage 5 predecessor work/)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    // Portfolio now lives within Executive Projects, not a duplicate navigation route.
    await page.goto("/?tab=exec-projects");
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Delivery insights", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delivery insights", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recorded attention", exact: true })).toBeVisible();
    const recordedProject = page.locator(".ev2p-attention-list .ev2p-context-row").filter({ hasText: "Stage 4 Browser Project" }).first();
    await expect(recordedProject).toContainText("Watch");
    await expect(recordedProject).not.toContainText(/score|ranking/i);
    // The new Insights view exposes programme evidence directly, without a redundant details toggle.
    await expect(page.getByRole("heading", { name: "Coordinated programmes", exact: true })).toBeVisible();
    await expect(page.locator(".row-t").filter({ hasText: /^Acceptance Unit A Programme$/ }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await page.goto("/?tab=delivery");
    await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Goals & development", exact: true })).toBeVisible();
    await context.close();
  }
});

test("Experience Stage 5 project register enforces payment, custody, slots and two-sided remittance", async ({ browser }) => {
  test.setTimeout(150000);
  const projectName = "Stage 4 Browser Project";
  const participantName = "Acceptance Camper";
  const unitB = "20000000-0000-4000-8000-000000000012";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Projects");
    await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
    await page.getByRole("tab", { name: /^Work/ }).click();
    await expect(page.locator(".fpg-work-table")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/fpg2-project-task-gold-desktop.png", fullPage: true });
    const firstProjectWork = page.locator(".fpg-work-table tbody tr").first();
    if (await firstProjectWork.count()) {
      await firstProjectWork.click();
      await expect(page.locator(".fpg-work-drawer")).toBeVisible();
      await page.screenshot({ path: "test-artifacts/fpg2-project-task-drawer-desktop.png", fullPage: true });
      await page.getByRole("button", { name: "Close work preview" }).click();
    }
    await page.getByRole("tab", { name: /^Register/ }).click();
    await expect(page.getByRole("heading", { name: "People, payments and custody", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add slot type", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register slot type").fill("Acceptance Dormitory");
    await dialog.getByLabel("Register slot capacity").fill("2");
    await dialog.getByRole("button", { name: "Add slot type", exact: true }).click();
    await expect(page.getByText("Slot inventory added.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add participant", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register participant name").fill(participantName);
    await dialog.getByLabel("Register participant contact").fill("ACC-CAMP-001");
    await dialog.getByLabel("Register amount due").fill("100");
    await dialog.getByRole("button", { name: "Add participant", exact: true }).click();
    await expect(page.getByText("Participant added to the project register.", { exact: true })).toBeVisible();

    let participantRow = page.locator("tbody tr").filter({ hasText: participantName });
    await expect(participantRow).toBeVisible();
    await participantRow.getByRole("button", { name: "Payment", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register payment amount").fill("50");
    await dialog.getByLabel("Register payment evidence").fill("ACC-PAY-001");
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByText("Payment recorded.", { exact: true })).toBeVisible();

    participantRow = page.locator("tbody tr").filter({ hasText: participantName });
    await expect(participantRow.getByRole("button", { name: "Allocate slot", exact: true })).toBeDisabled();

    await participantRow.getByRole("button", { name: "Payment", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register payment amount").fill("50");
    await dialog.getByLabel("Register payment evidence").fill("ACC-PAY-002");
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByText("Payment recorded.", { exact: true })).toBeVisible();

    participantRow = page.locator("tbody tr").filter({ hasText: participantName });
    await participantRow.getByRole("button", { name: "Allocate slot", exact: true }).click();
    dialog = page.getByRole("dialog");
    const slotSelect = dialog.getByLabel("Register slot allocation");
    const slotValue = await slotSelect.locator("option").filter({ hasText: "Acceptance Dormitory" }).first().getAttribute("value");
    expect(slotValue).toBeTruthy();
    await slotSelect.selectOption(slotValue);
    await dialog.getByRole("button", { name: "Allocate slot", exact: true }).click();
    await expect(page.getByText("Slot allocated.", { exact: true })).toBeVisible();

    participantRow = page.locator("tbody tr").filter({ hasText: participantName });
    await participantRow.getByRole("button", { name: "Custody", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register custody stage").fill("Collected by Unit A representative");
    await dialog.getByLabel("Register custody context").fill("Acceptance handoff");
    await dialog.getByRole("button", { name: "Record custody stage", exact: true }).click();
    await expect(page.getByText("Custody stage recorded.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Record remittance", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Register remittance to").selectOption(unitB);
    await dialog.getByLabel("Register remittance amount").fill("100");
    await dialog.getByLabel("Register remittance evidence").fill("ACC-REM-001");
    await dialog.getByRole("button", { name: "Record remittance", exact: true }).click();
    await expect(page.getByText("Remittance recorded. The receiving unit must confirm it.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Finance");
    await expect(page.locator(".fpg-finance-dashboard")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/fpg3-finance-gold-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "Between departments", exact: true }).click();
    const transferRow = page.locator(".row").filter({ hasText: /Stage 4 Browser Project register remittance/ }).first();
    await expect(transferRow).toBeVisible();
    await transferRow.getByRole("button", { name: "We received this", exact: true }).click();
    await expect(transferRow.getByText("Confirmed by them", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Delivery");
    const leadershipProject = page.locator(".ev2p-context-row").filter({ hasText: projectName }).first();
    await expect(leadershipProject).toBeVisible();
    await leadershipProject.getByRole("button", { name: "Operational details", exact: true }).click();
    await expect(page.getByText(participantName, { exact: true })).toBeVisible();
    const reconciliation = page.locator("table").filter({ hasText: "Confirmed remitted" }).first();
    await expect(reconciliation).toContainText("GHS 100");
    await expect(page.getByText("Acceptance Dormitory", { exact: true }).first()).toBeVisible();
    await context.close();
  }
});

test("Experience Stage 6 finance lets a Manager record own-unit spend without inventing a bank balance", async ({ browser }) => {
  test.setTimeout(90000);
  const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
  await go(page, "Finance");
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible();
  await expect(page.getByText(/Money in means confirmed transfers received by this unit/i)).toBeVisible();

  await page.getByRole("button", { name: "Record expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Expense description").fill("Experience Stage 6 own-unit spend");
  await dialog.getByLabel("Expense amount").fill("25");
  await dialog.getByLabel("Expense source").fill("Receipt ST6-001");
  await dialog.getByRole("button", { name: "Record expense", exact: true }).click();

  await expect(page.getByText(/Expense recorded for your unit/i)).toBeVisible();
  await expect(page.getByText(/Managers can add spending only for their own unit/i)).toBeVisible();
  await context.close();
});

test("Experience Stage 7 keeps work capture simple, staff-owned and manager-confirmed", async ({ browser }) => {
  test.setTimeout(180000);
  const title = "Experience Stage 7 four field responsibility";
  const proposalName = "Experience Stage 7 staff proposed project";
  const roomMessage = "Experience Stage 7 room responsibility source";

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await page.getByRole("button", { name: "Give out work" }).click();
    await page.getByLabel("Work to complete").fill(title);
    await page.getByLabel("Why this matters").fill("This responsibility verifies the approved four-field contract.");
    const assignee = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Staff Fixture" }) });
    await assignee.selectOption({ label: "Staff Fixture" });
    await page.locator('input[type="datetime-local"]').last().fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0,16));
    await expect(page.getByLabel("Finished result")).toHaveValue("");
    await page.getByRole("button", { name: "Give it out", exact: true }).click();
    await expect(page.getByText(/is with them/)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Work");
    await openCompleteWorkRecord(page, title);
    await page.getByLabel("Add my step").fill("Staff-owned breakdown step");
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(page.getByRole("button", { name: /Staff-owned breakdown step/ })).toBeVisible();

    await page.getByRole("button", { name: "← Back" }).click();
    await go(page, "Work");
    await page.getByRole("button", { name: "Propose project", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Proposed project name").fill(proposalName);
    await dialog.getByLabel("Proposed project purpose").fill("A staff-originated project proposal that requires Unit Head confirmation.");
    await dialog.getByRole("button", { name: "Send proposal", exact: true }).click();
    await expect(page.getByText(/Project proposed. Your Unit Head must confirm it/i)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Projects");
    const proposal = page.locator(".ev2p-attention").filter({ hasText: proposalName }).first();
    await expect(proposal).toBeVisible();
    await proposal.getByRole("button", { name: "Confirm project", exact: true }).click();
    await expect(page.getByRole("heading", { name: proposalName, exact: true })).toBeVisible();

    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    const composer = page.getByPlaceholder("Message your unit");
    await composer.fill(roomMessage);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const message = page.locator(".room-message").filter({ hasText: roomMessage }).last();
    await expect(message).toBeVisible();
    await message.getByRole("button", { name: "Make this a responsibility?", exact: true }).click();

    await expect(page.getByLabel("Work to complete")).toHaveValue(roomMessage);
    await page.getByLabel("Why this matters").fill("Captured from an accountable Room message.");
    const assignee = page.locator("select.field").filter({ has: page.locator("option", { hasText: "Staff Fixture" }) });
    await assignee.selectOption({ label: "Staff Fixture" });
    await page.locator('input[type="datetime-local"]').last().fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0,16));
    await page.getByRole("button", { name: "Give it out", exact: true }).click();
    await expect(page.getByText(/is with them/)).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).last().click();
    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    await expect(page.getByText(/Created .* from this message\./)).toBeVisible();
    await context.close();
  }
});

test("Stage 6 Workload keeps capacity components factual and manager-scoped", async ({ browser }) => {
  test.setTimeout(120000);

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Workload");
    await expect(page.getByRole("heading", { name: "Workload", exact: true })).toBeVisible();
    await expect(page.getByText(/does not turn these components into an employee score/i)).toBeVisible();

    await page.getByLabel("Workload person").selectOption("31000000-0000-4000-8000-000000000001");
    await page.getByLabel("Planning hours per week").fill("35");
    await page.getByLabel("Planning capacity reason").fill("Acceptance Stage 6 planning capacity");
    await page.getByRole("button", { name: "Record capacity version", exact: true }).click();
    await expect(page.getByText("Planning capacity recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Workload project").selectOption({ label: "Stage 4 Browser Project" });
    await page.getByLabel("Project commitment hours per week").fill("10");
    await page.getByLabel("Project commitment reason").fill("Acceptance Stage 6 project commitment");
    await page.getByRole("button", { name: "Record commitment version", exact: true }).click();
    await expect(page.getByText("Project commitment recorded.", { exact: true })).toBeVisible();

    await page.reload();
    const workloadPerson = page.getByLabel("Workload person");
    await workloadPerson.selectOption("31000000-0000-4000-8000-000000000001");
    await expect(workloadPerson).toHaveValue("31000000-0000-4000-8000-000000000001");
    await expect(page.getByText("35 h", { exact: true }).first()).toBeVisible();

    const capacityMetric = page.getByRole("button", { name: /weekly planning capacity/i }).last();
    await capacityMetric.click();
    await expect(workloadPerson).toHaveValue("31000000-0000-4000-8000-000000000001");
    await expect(page.getByText("Planning capacity history", { exact: true })).toBeVisible();
    await expect(page.getByText("Acceptance Stage 6 planning capacity", { exact: true })).toBeVisible();

    const commitmentMetric = page.getByRole("button", { name: /project commitment \/ week/i }).last();
    await commitmentMetric.click();
    await expect(page.getByText("Project commitments overlapping this horizon", { exact: true })).toBeVisible();
    await expect(page.getByText("10 h \/ week", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Acceptance Stage 6 project commitment", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage6-workload-desktop.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Workload");
    await expect(page.getByRole("heading", { name: "Workload", exact: true })).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage6-workload-mobile.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await page.goto("/?tab=workload");
    await expect(page.getByRole("heading", { name: "Workload", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 7 Reviews & development keeps appraisal evidence factual, visible and human-judged", async ({ browser }) => {
  test.setTimeout(180000);
  const cycleName = "Acceptance Stage 7 review";
  const reflectionText = "I completed the recorded work and want to improve how I plan the next cycle.";
  const assessmentText = "The recorded outcomes show reliable completion. The next focus is clearer planning before deadlines.";
  const conversationText = "We reviewed the evidence together and agreed to make weekly commitments explicit before execution.";
  const planFocus = "Planning before execution";
  const planOutcome = "Make weekly commitments explicit before work starts.";
  const planSteps = "Set the week plan on Monday, review it with the manager, and record changes.";
  const feedbackText = "Keep the planning note attached to the work before execution starts.";
  const staffReply = "I agree with the next step and will record changes during the week.";
  const feedbackReply = "Understood. I will keep the planning note with the work record.";

  const today = new Date();
  const start = new Date(today.getTime() - 30 * 86400000);
  const iso = (value) => value.toISOString().slice(0, 10);

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Performance & development");
    await expect(page.getByRole("heading", { name: "Reviews & development", exact: true })).toBeVisible();
    await expect(page.getByText(/does not calculate employee scores or rankings/i)).toBeVisible();

    await page.getByRole("button", { name: "Open review period", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Review period name").fill(cycleName);
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Review period start").fill(iso(start));
    await dialog.getByLabel("Review period end").fill(iso(today));
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Review period reason").fill("Acceptance Stage 7 evidence-first review");
    await dialog.getByRole("button", { name: "Open review period", exact: true }).click();

    await expect(page.getByText("Review period opened and factual evidence packs assembled.", { exact: true })).toBeVisible();
    await expect(page.getByText(cycleName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Staff Fixture", { exact: true }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("button", { name: /Reviews & development/ }).click();
    await expect(page.getByRole("heading", { name: "Reviews & development", exact: true })).toBeVisible();
    await expect(page.getByText(cycleName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Activity sessions are shown only as context/i)).toBeVisible();

    await page.getByLabel("Employee reflection").fill(reflectionText);
    await page.getByRole("button", { name: "Submit reflection", exact: true }).click();
    await expect(page.getByText("Reflection recorded.", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Employee reflection")).toHaveValue(reflectionText);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Performance & development");
    await expect(page.getByRole("heading", { name: "Reviews & development", exact: true })).toBeVisible();
    const staffCase = page.locator(".performance-case-row").filter({ hasText: "Staff Fixture" });
    await expect(staffCase).toBeVisible();
    await staffCase.click();
    await expect(page.getByText(reflectionText, { exact: true })).toBeVisible();

    await page.getByLabel("Manager assessment").fill(assessmentText);
    await page.getByRole("button", { name: "Record assessment", exact: true }).click();
    await expect(page.getByText("Manager assessment recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Review conversation record").fill(conversationText);
    await page.getByRole("button", { name: "Record conversation", exact: true }).click();
    await expect(page.getByText("Review conversation recorded.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Create plan", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Development focus").fill(planFocus);
    await dialog.getByLabel("Development desired outcome").fill(planOutcome);
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Development next steps").fill(planSteps);
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Development start").fill(iso(today));
    const target = new Date(today.getTime() + 30 * 86400000);
    await dialog.getByLabel("Development target").fill(iso(target));
    await dialog.getByLabel("Development change reason").fill("Acceptance development plan agreed in review");
    await dialog.getByRole("button", { name: "Record development plan", exact: true }).click();
    await expect(page.getByText("Development plan recorded.", { exact: true })).toBeVisible();

    await page.getByLabel("Feedback type").selectOption("guidance");
    await page.getByLabel("Visible feedback").fill(feedbackText);
    await page.getByRole("button", { name: "Record feedback", exact: true }).click();
    await expect(page.getByText("Visible feedback recorded.", { exact: true })).toBeVisible();

    // Publication is HR-only. The Manager requests an exact-version release
    // instead of bypassing HR through the retired Mark-as-shared shortcut.
    await page.getByLabel("Performance release request reason").fill("Manager completed a factual review and requests independent HR publication.");
    await page.getByRole("button", { name: "Submit release request to HR", exact: true }).click();
    await expect(page.getByText(
      "The manager's assessment release request was recorded for HR review. The employee cannot see the unpublished manager narrative.",
      { exact: true }
    )).toBeVisible();

    await page.reload();
    const reloadedCase = page.locator(".performance-case-row").filter({ hasText: "Staff Fixture" });
    await reloadedCase.click();
    await expect(page.locator(".performance-narrative p").filter({ hasText: assessmentText }).first()).toBeVisible();
    await expect(page.getByText(planFocus, { exact: true })).toBeVisible();
    await expect(page.getByText(feedbackText, { exact: true })).toBeVisible();

    // Regression: an earlier employee's empty feedback response must not replace
    // the current employee's recorded feedback when network responses overlap.
    // Delay only a genuine local fixture read; never stub a permission/data result.
    let markOlderStarted;
    const olderStarted = new Promise((resolve) => { markOlderStarted = resolve; });
    let delayedOlder = false;
    const olderResponse = page.waitForResponse((response) =>
      response.url().includes("/rest/v1/feedback_notes")
      && decodeURIComponent(response.url()).includes("31000000-0000-4000-8000-000000000006")
      && response.status() === 200,
    { timeout: 15000 });
    await page.route("**/rest/v1/feedback_notes?*", async (route) => {
      const isOlderPerson = decodeURIComponent(route.request().url()).includes("31000000-0000-4000-8000-000000000006");
      if (isOlderPerson && !delayedOlder) {
        delayedOlder = true;
        markOlderStarted();
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      await route.continue();
    });
    await page.locator(".performance-case-row").filter({ hasText: "Same Unit Fixture" }).click();
    await olderStarted;
    await reloadedCase.click();
    await expect(page.getByText(feedbackText, { exact: true })).toBeVisible();
    await olderResponse;
    await expect(page.getByText(feedbackText, { exact: true })).toBeVisible();
    await expect(page.getByText("No continuous feedback has been recorded.", { exact: true })).toHaveCount(0);
    await page.unroute("**/rest/v1/feedback_notes?*");

    await page.screenshot({ path: "test-artifacts/stage7-performance-manager.png", fullPage: true });
    await context.close();
  }

  // A pending Manager request is never employee-visible before HR signs
  // the decision, even though the employee can still see their own feedback.
  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("button", { name: /Reviews & development/ }).click();
    await expect(page.getByText(assessmentText, { exact: true })).toHaveCount(0);
    await expect(page.getByText(conversationText, { exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Performance & development");
    const staffCase = page.locator(".performance-case-row").filter({ hasText: "Staff Fixture" }).first();
    await expect(staffCase).toBeVisible({ timeout: 15000 });
    await staffCase.click();
    await page.getByRole("tab", {name:"3 · Publication",exact:true}).click();
    const approve = page.getByRole("button", { name: "HR approve publication", exact: true });
    await expect(approve).toBeVisible({ timeout: 15000 });
    await page.getByLabel("HR assessment publication decision reason").fill(
      "HR independently reviewed the manager narrative and approved this version for employee publication."
    );
    await approve.click();
    await expect(page.getByText(
      "HR approved publication of this manager assessment version.", { exact: true }
    )).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("button", { name: /Reviews & development/ }).click();
    await expect(page.getByText(assessmentText, { exact: true })).toBeVisible();
    await expect(page.getByText(conversationText, { exact: true })).toBeVisible();
    await expect(page.getByText(planFocus, { exact: true })).toBeVisible();
    await expect(page.getByText(feedbackText, { exact: true })).toBeVisible();

    await page.getByLabel("Review response").fill(staffReply);
    await page.getByRole("button", { name: "Record response", exact: true }).first().click();
    await expect(page.getByText("Your response was recorded.", { exact: true })).toBeVisible();

    const feedbackCard = page.locator(".performance-feedback-card").filter({ hasText: feedbackText });
    await feedbackCard.getByRole("button", { name: "Respond", exact: true }).click();
    await feedbackCard.getByLabel("Feedback response").fill(feedbackReply);
    await feedbackCard.getByRole("button", { name: "Record response", exact: true }).click();
    await expect(page.getByText("Your feedback response was recorded.", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(staffReply, { exact: true })).toBeVisible();
    await expect(page.getByText(feedbackReply, { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Stage 7 Staff review overflowed the 390px viewport").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/stage7-performance-staff-mobile.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Performance & development");
    await page.getByText(cycleName, { exact: true }).first().click();
    await page.getByRole("button", { name: "Close selected period", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Review period close reason").fill("Acceptance Stage 7 review period completed");
    await dialog.getByRole("button", { name: "Close review period", exact: true }).click();
    await expect(page.getByText("Review period closed.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    await page.goto("/?tab=performance");
    await expect(page.getByRole("heading", { name: "Reviews & development", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 8 Learning publishes structured learning and preserves factual completion", async ({ browser }) => {
  test.setTimeout(180000);
  const courseTitle = "Acceptance Stage 8 Learning";
  const courseSummary = "A practical course used to verify structured learning.";
  const moduleTitle = "Acceptance required module";
  const resourceTitle = "Acceptance learning resource";
  const assignmentReason = "Acceptance learning for Staff Fixture";

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Learning");
    await expect(page.getByRole("heading", { name: "Learning", exact: true })).toBeVisible();
    await expect(page.getByText("Build useful learning programmes. Help people find their next step.",{exact:true})).toBeVisible();

    await page.getByRole("button", { name: "Create course", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Learning course title").fill(courseTitle);
    await dialog.getByLabel("Learning course summary").fill(courseSummary);
    await dialog.getByLabel("Learning course minutes").fill("30");
    await dialog.getByRole("button", { name: "Create draft course", exact: true }).click();
    await expect(page.getByText("Draft course created.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ Add module", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Learning module title").fill(moduleTitle);
    await dialog.getByLabel("Learning module summary").fill("One required module with one reviewed resource.");
    await dialog.getByLabel("Learning module minutes").fill("30");
    await dialog.getByRole("button", { name: "Add module", exact: true }).click();
    await expect(page.getByText("Course module added.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add resource", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Learning resource type").selectOption("link");
    await dialog.getByLabel("Learning resource title").fill(resourceTitle);
    await dialog.getByLabel("Learning resource URL").fill("https://example.com/stage8-learning");
    await dialog.getByRole("button", { name: "Add resource", exact: true }).click();
    await expect(page.getByText("Learning resource added.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Review & publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish course", exact: true }).click();
    await expect(page.getByText("Course published.", { exact: true })).toBeVisible();
    await expect(page.getByRole("region",{name:"Course builder",exact:true}).getByText("Published", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "3 · Audience", exact: true }).click();
    await page.getByRole("button", { name: "Create assignment rule", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Learning target kind").selectOption("person");
    await dialog.getByLabel("Learning target person").selectOption({ label: "Staff Fixture" });
    await dialog.getByLabel("Learning due days").fill("14");
    await dialog.getByLabel("Learning assignment reason").fill(assignmentReason);
    await dialog.getByRole("button", { name: "Create assignment rule", exact: true }).click();
    await expect(page.getByText("Learning assignment rule created.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Learning");
    await expect(page.getByRole("heading", { name: "Learning", exact: true })).toBeVisible();
    await expect(page.getByText(courseTitle, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(moduleTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(resourceTitle, { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 1 required modules complete", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Complete module", exact: true }).click();
    await expect(page.getByText("Module completion recorded.", { exact: true })).toBeVisible();
    await expect(page.getByText("1 of 1 required modules complete", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(courseTitle, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 of 1 required modules complete", { exact: true })).toBeVisible();

    await page.getByRole("tablist", {name:"Learning views"}).getByRole("tab", { name: "Completed learning", exact: true }).click();
    await expect(page.getByText(courseTitle, { exact: true })).toBeVisible();
    await expect(page.getByText("CEAC OS course", { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Stage 8 Staff learning overflowed the 390px viewport").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/stage8-learning-staff-mobile.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Learning");
    await page.getByRole("tablist", {name:"Learning views"}).getByRole("tab", { name: "Team learning", exact: true }).click();
    const staffLearning = page.locator(".learning-assignment-card").filter({ hasText: "Staff Fixture" });
    await expect(staffLearning).toBeVisible();
    await expect(staffLearning.getByText(courseTitle, { exact: true })).toBeVisible();
    await expect(staffLearning.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create course", exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Learning");
    await page.getByRole("tablist", {name:"Learning views"}).getByRole("tab", { name: "Progress", exact: true }).click();
    const staffLearning = page.locator(".learning-assignment-card").filter({ hasText: "Staff Fixture" });
    await expect(staffLearning).toBeVisible();
    await staffLearning.click();
    await expect(page.getByText("1 of 1 required modules complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Correct completion", exact: true })).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage8-learning-admin.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    await page.goto("/?tab=learning");
    await expect(page.getByRole("heading", { name: "Learning", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 9 Workforce keeps schedule, session and leave context factual across roles", async ({ browser }) => {
  test.setTimeout(180000);
  const dayTypeName = "Acceptance working day";
  const scheduleReason = "Acceptance Stage 9 workforce schedule";
  const correctionReason = "Acceptance Stage 9 context correction";
  const weekday = ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];
  const today = new Date();
  const leaveStart = new Date(today.getTime() + 10 * 86400000);
  const leaveEnd = new Date(today.getTime() + 11 * 86400000);
  const iso = (value) => value.toISOString().slice(0, 10);

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Workforce");
    await expect(page.getByRole("heading", { name: "Time & Leave", exact: true })).toBeVisible();
    await expect(page.getByText(/does not rank people, score attendance, infer absence from missing sessions/i)).toBeVisible();

    await page.getByRole("tab", { name: "Schedules & policy", exact: true }).click();
    await page.getByRole("button", { name: "Add day type", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Day type name").fill(dayTypeName);
    await dialog.getByLabel("Day type description").fill("Acceptance day with recorded session context");
    await dialog.getByRole("button", { name: "Record day type", exact: true }).click();
    await expect(page.getByText("Day type recorded.", { exact: true })).toBeVisible();
    await expect(page.locator(".workforce-data-status")).toContainText(/Visible people:\s*[1-9]/);
    await expect(page.locator(".workforce-data-status")).toContainText(/Active day types:\s*[1-9]/);
    await expect(page.getByText(dayTypeName, { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Workforce");
    await page.getByRole("tab", { name: "Schedules & policy", exact: true }).click();
    await expect(page.getByText(dayTypeName, { exact: true })).toBeVisible();
    // HR now records a complete employee-id week through the unified editor.
    await page.getByLabel("Choose employee working schedule").selectOption({label:"Staff Fixture"});
    const scheduleEditor=page.locator(".ev2p-admin-schedule");
    await scheduleEditor.getByRole("button",{name:"Edit authorised work schedule",exact:true}).click();
    for(const dayLabel of ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]){
      await scheduleEditor.getByLabel(dayLabel+" work arrangement",{exact:true}).selectOption({label:dayTypeName});
      await scheduleEditor.getByLabel(dayLabel+" start",{exact:true}).fill("10:00");
      await scheduleEditor.getByLabel(dayLabel+" end",{exact:true}).fill("17:00");
    }
    await scheduleEditor.getByLabel("Effective from",{exact:true}).fill(iso(today));
    await scheduleEditor.getByLabel("HR schedule reason",{exact:true}).fill(scheduleReason);
    await scheduleEditor.getByRole("button",{name:"Record HR-authorised schedule",exact:true}).click();
    await expect(scheduleEditor.getByRole("table",{name:"Saved employee seven-day working week"})).toContainText(dayTypeName);

    await page.reload();
    await go(page, "Workforce");
    // The current HR Today view is a review queue, not the retired person cards.
    // Include employees whose configured schedule removes them from Needs review.
    await page.getByLabel("Filter daily workforce records",{exact:true}).selectOption("all");
    await page.getByLabel("Find workforce evidence",{exact:true}).fill("Staff Fixture");
    const staffCard=page.locator(".ev2wf-today-review-entry").filter({hasText:"Staff Fixture"});
    await expect(staffCard).toBeVisible();
    await expect(staffCard).toContainText(dayTypeName);

    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await expect(page.getByLabel("Workforce calendar unit filter")).toBeVisible();
    await expect(page.getByLabel("Workforce calendar person filter")).toBeVisible();
    await page.getByLabel("Workforce calendar person filter").selectOption("31000000-0000-4000-8000-000000000001");

    await page.getByRole("tab", { name: "Work sessions", exact: true }).click();
    await expect(page.getByText(/Session history is factual activity context/i)).toBeVisible();

    await page.getByRole("tab", { name: "Recorded differences", exact: true }).click();
    await expect(page.getByText(/does not convert a missing or different record/i)).toBeVisible();

    await page.getByRole("tab", { name: "Corrections", exact: true }).click();
    const correctionWorkflow=page.locator(".ev2wf-correction-workflow");
    await expect(correctionWorkflow.getByRole("heading",{name:"Missed check-in and attendance corrections"})).toBeVisible();
    await expect(correctionWorkflow.getByText(/manager approves the correction; HR audits approved corrections afterward/i)).toBeVisible();
    // Legacy direct HR modification/reversal is prohibited. Dedicated browser
    // approval test separately verifies Staff request → Manager decision → HR audit.
    await expect(page.getByRole("button",{name:"Record correction",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Reverse correction",exact:true})).toHaveCount(0);

    await page.getByRole("tab", { name: "Schedules & policy", exact: true }).click();
    await page.getByRole("button", { name: "Configure leave policy", exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Policy accrual method")).toHaveValue("");
    await expect(dialog.getByLabel("Policy carryover method")).toHaveValue("");
    await expect(dialog.getByLabel("Policy approval route")).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Activate confirmed policy", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    await page.screenshot({ path: "test-artifacts/stage9-workforce-admin.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("tab", { name: "Leave", exact: true }).click();
    await page.getByRole("button", { name: "Ask for leave", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const dateInputs = dialog.locator('input[type="date"]');
    await dateInputs.nth(0).fill(iso(leaveStart));
    await dateInputs.nth(1).fill(iso(leaveEnd));
    await dialog.getByPlaceholder("A short reason").fill("Acceptance Stage 9 leave lifecycle");
    await dialog.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.locator(".leave-request-row").filter({ hasText: "annual leave" }).first()).toContainText("Waiting");
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Workforce");
    await expect(page.getByRole("heading", { name: "Workforce", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedules & policy", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Corrections", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record correction", exact: true })).toHaveCount(0);

    await page.getByRole("tab", { name: "Leave", exact: true }).click();
    const leaveRow = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: "Annual" }).filter({ hasText: "Pending" }).first();
    await expect(leaveRow).toBeVisible();
    page.once("dialog", (prompt) => prompt.accept("Acceptance manager approval"));
    await leaveRow.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Leave decision recorded.", { exact: true })).toBeVisible();
    await expect(page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: "Escalated" }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Workforce");
    await page.getByRole("tab", { name: "Leave requests", exact: true }).click();
    const administrationRow = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: "HR decision needed" }).first();
    await expect(administrationRow).toBeVisible();
    await expect(administrationRow.getByText(/Manager approved · Administration final decision required/i)).toBeVisible();
    page.once("dialog", (prompt) => prompt.accept("Acceptance Administration final approval"));
    await administrationRow.getByRole("button", { name: "Admin approve", exact: true }).click();
    await expect(page.getByText("Leave decision recorded.", { exact: true })).toBeVisible();

    const approvedRow = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: "Approved" }).first();
    await expect(approvedRow).toBeVisible();
    page.once("dialog", (prompt) => prompt.accept("Acceptance approval reversal"));
    await approvedRow.getByRole("button", { name: "Reverse approval", exact: true }).click();
    await expect(page.getByText("Leave decision recorded.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("tab", { name: "Leave", exact: true }).click();
    const requestRow = page.locator(".leave-request-row").filter({ hasText: "annual leave" }).first();
    await expect(requestRow).toContainText("Waiting");
    await requestRow.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(requestRow).toContainText("Cancelled");

    await page.getByRole("button", { name: /My workforce context/ }).click();
    await expect(page.getByRole("heading", { name: "Workforce", exact: true })).toBeVisible();
    const ownWorkforceCard = page.locator(".workforce-person").filter({ hasText: "Staff Fixture" }).first();
    await expect(ownWorkforceCard).toBeVisible();
    await expect(page.locator(".workforce-person").filter({ hasText: "Manager Fixture" })).toHaveCount(0);
    await expect(ownWorkforceCard.getByText(dayTypeName, { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Stage 9 Staff workforce overflowed the 390px viewport").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/stage9-workforce-staff-mobile.png", fullPage: true });
    await context.close();
  }
});

test("Stage 10 Assets & devices preserves factual custody and lifecycle across roles", async ({ browser }) => {
  test.setTimeout(180000);
  const assetCode = "CEAC-ACCEPT-001";
  const serial = "ACCEPT-SERIAL-001";
  const today = new Date();
  const purchase = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0,10);
  const warranty = new Date(today.getTime() + 305 * 86400000).toISOString().slice(0,10);
  const expectedReturn = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0,10);
  const unitA = "20000000-0000-4000-8000-000000000011";

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Assets & devices");
    await expect(page.getByRole("heading", { name: "Assets & devices", exact: true })).toBeVisible();
    await expect(page.getByText(/does not remotely wipe, lock, configure or monitor device operating systems/i)).toBeVisible();

    await page.getByRole("button", { name: "Add asset", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset code").fill(assetCode);
    await dialog.getByLabel("Asset category").fill("Camera");
    await dialog.getByLabel("Asset manufacturer").fill("Sony");
    await dialog.getByLabel("Asset model").fill("FX3");
    await dialog.getByLabel("Asset serial number").fill(serial);
    await dialog.getByLabel("Asset unit").selectOption(unitA);
    await dialog.getByLabel("Asset purchase date").fill(purchase);
    await dialog.getByLabel("Asset purchase vendor").fill("Acceptance Supplier");
    await dialog.getByLabel("Asset purchase cost").fill("24000");
    await dialog.getByLabel("Asset purchase currency").fill("GHS");
    await dialog.getByLabel("Asset warranty expiry").fill(warranty);
    await dialog.getByLabel("Asset location").fill("Media store");
    await dialog.getByLabel("Asset condition note").fill("Issued new for acceptance");
    await dialog.getByLabel("Asset notes").fill("Stage 10 browser acceptance asset");
    await dialog.getByRole("button", { name: "Add asset", exact: true }).click();
    await expect(page.getByText("Asset added to inventory.", { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Assets & devices");
    const card = page.locator(".asset-card").filter({ hasText: assetCode });
    await expect(card).toBeVisible();
    await expect(card).toContainText("GHS 24,000");
    await expect(card).toContainText(serial);

    await card.getByRole("button", { name: "Assign", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset assignee").selectOption({ label: "Staff Fixture" });
    await dialog.getByLabel("Asset assignment unit").selectOption(unitA);
    await dialog.getByLabel("Asset assignment location").fill("Production desk");
    await dialog.getByLabel("Asset expected return").fill(expectedReturn);
    await dialog.getByLabel("Asset assignment condition").fill("Good condition at handover");
    await dialog.getByLabel("Asset assignment reason").fill("Stage 10 acceptance custody");
    await dialog.getByRole("button", { name: "Assign asset", exact: true }).click();
    await expect(page.getByText("Asset assigned.", { exact: true })).toBeVisible();
    await expect(card).toContainText("Staff Fixture");
    await page.screenshot({ path: "test-artifacts/stage10-assets-admin.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("button", { name: /My assets/ }).click();
    await expect(page.getByRole("heading", { name: "Assets & devices", exact: true })).toBeVisible();
    const card = page.locator(".asset-card").filter({ hasText: assetCode });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Staff Fixture");
    await expect(card.getByRole("button", { name: "Edit details", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "History", exact: true }).click();
    await expect(page.getByText("Assigned", { exact: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Stage 10 Staff assets overflowed the 390px viewport").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/stage10-assets-staff-mobile.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Assets & devices");
    await expect(page.locator(".asset-card").filter({ hasText: assetCode })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add asset", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit details", exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "other@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Assets");
    await expect(page.getByText(assetCode, { exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Assets & devices");
    let card = page.locator(".asset-card").filter({ hasText: assetCode });

    await card.getByRole("button", { name: "Transfer", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset assignee").selectOption({ label: "Same Unit Fixture" });
    await dialog.getByLabel("Asset assignment unit").selectOption(unitA);
    await dialog.getByLabel("Asset assignment location").fill("Same-unit custody");
    await dialog.getByLabel("Asset assignment reason").fill("Stage 10 acceptance transfer");
    await dialog.getByRole("button", { name: "Transfer custody", exact: true }).click();
    await expect(page.getByText("Asset custody transferred.", { exact: true })).toBeVisible();

    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await card.getByRole("button", { name: "Return", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset return location").fill("Media store");
    await dialog.getByLabel("Asset return condition").fill("Returned in good condition");
    await dialog.getByLabel("Asset return reason").fill("Stage 10 acceptance return");
    await dialog.getByRole("button", { name: "Record return", exact: true }).click();
    await expect(page.getByText("Asset returned.", { exact: true })).toBeVisible();

    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await card.getByRole("button", { name: "Start repair", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset lifecycle note").fill("Battery inspection");
    await dialog.getByLabel("Asset lifecycle reason").fill("Stage 10 acceptance repair");
    await dialog.getByRole("button", { name: "Record repair started", exact: true }).click();
    await expect(page.getByText("Repair Started recorded.", { exact: true })).toBeVisible();

    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await card.getByRole("button", { name: "Warranty claim", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset lifecycle note").fill("Warranty reference AC-10");
    await dialog.getByLabel("Asset lifecycle reason").fill("Stage 10 acceptance warranty");
    await dialog.getByRole("button", { name: "Record warranty claimed", exact: true }).click();
    await expect(page.getByText("Warranty Claimed recorded.", { exact: true })).toBeVisible();

    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await card.getByRole("button", { name: "Complete repair", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset lifecycle note").fill("Battery inspection completed");
    await dialog.getByLabel("Asset lifecycle reason").fill("Stage 10 acceptance repair complete");
    await dialog.getByRole("button", { name: "Record repair completed", exact: true }).click();
    await expect(page.getByText("Repair Completed recorded.", { exact: true })).toBeVisible();

    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await card.getByRole("button", { name: "Retire", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Asset lifecycle note").fill("Acceptance lifecycle complete");
    await dialog.getByLabel("Asset lifecycle reason").fill("Stage 10 acceptance retirement");
    await dialog.getByRole("button", { name: "Record retired", exact: true }).click();
    await expect(page.getByText("Retired recorded.", { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Assets & devices");
    card = page.locator(".asset-card").filter({ hasText: assetCode });
    await expect(card).toContainText("Retired");
    await expect(card).toContainText("GHS 24,000");
    await expect(card).toContainText(serial);

    await page.getByRole("tab", { name: "History", exact: true }).click();
    await expect(page.getByText("Transferred", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Returned", { exact: true }).first()).toBeVisible();

    await page.getByRole("tab", { name: "Service & lifecycle", exact: true }).click();
    await expect(page.getByText("Repair Started", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Warranty Claimed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Retired", { exact: true }).first()).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    await page.goto("/?tab=assets");
    await expect(page.getByRole("heading", { name: "Assets & devices", exact: true })).toHaveCount(0);
    await context.close();
  }
});

test("Stage 11 Compliance records policies, acknowledgement, evidence and exceptions without scoring", async ({ browser }) => {
  test.setTimeout(180000);
  const policyTitle = "Acceptance workplace safety policy";
  const requirementTitle = "Acceptance safety certificate";
  const evidenceRef = "ACCEPT-CERT-001";
  const today = new Date();
  const expiry = new Date(today.getTime() + 365 * 86400000).toISOString().slice(0,10);
  const requestedUntil = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0,10);
  const approvedUntil = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0,10);

  // Exercise the independent Compliance operator with an ordinary audited grant
  // in the disposable loopback fixture, rather than rendering HR as Compliance.
  expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
  const authority = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const login=await authority.auth.signInWithPassword({email:"admin@ceac.local.test",password:rolePassword});
  expect(login.error).toBeNull();
  const grant=await authority.rpc("grant_capability",{p_profile_id:"31000000-0000-4000-8000-000000000005",p_capability:"compliance.manage",p_scope_unit_id:null,p_reason:"Isolated acceptance: existing non-HR Compliance operator"});
  expect(grant.error).toBeNull();expect(grant.data?.id).toBeTruthy();
  let grantActive=true;
  async function revokeOperator(){
    const result=await authority.rpc("revoke_capability",{p_grant_id:grant.data.id,p_reason:"Isolated Compliance workflow acceptance complete"});
    expect(result.error).toBeNull();grantActive=false;
  }
  try {
  {
    const { context, page } = await openAs(browser, "other@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Compliance");
    await expect(page.getByRole("heading", { name: "Compliance", exact: true })).toBeVisible();
    await page.getByText("Recorded policy context", { exact: true }).click();
    await expect(page.getByText(/does not calculate an employee compliance score/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your review desk", exact: true })).toBeVisible();
    await expect(page.getByText(/is not an absence or misconduct finding/i)).toBeVisible();
    await page.getByRole("tab", { name: "Policies", exact: true }).click();

    await page.getByRole("button", { name: "Publish policy", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance policy title").fill(policyTitle);
    await dialog.getByLabel("Compliance policy category").fill("Safety");
    await dialog.getByLabel("Compliance policy summary").fill("Acceptance policy for factual compliance workflow testing.");
    await dialog.getByLabel("Compliance policy body").fill("Read, acknowledge and provide the required safety evidence.");
    await dialog.getByLabel("Compliance policy expiry").fill(expiry);
    await dialog.getByLabel("Compliance policy source").fill("Acceptance approved source");
    await dialog.getByRole("button", { name: "Add applicability", exact: true }).click();

    await dialog.getByLabel("Compliance requirement code").fill("SAFE");
    await dialog.getByLabel("Compliance requirement title").fill(requirementTitle);
    await dialog.getByLabel("Compliance requirement description").fill("Submit the currently valid safety certificate reference.");
    await dialog.getByText("Evidence required", { exact: true }).click();
    await dialog.getByLabel("Compliance evidence kind").fill("certificate");
    await dialog.getByLabel("Compliance evidence valid days").fill("365");
    await dialog.getByRole("button", { name: "Add requirement", exact: true }).click();
    await dialog.getByLabel("Compliance policy reason").fill("Stage 11 browser acceptance publication");
    await dialog.getByRole("button", { name: "Publish policy", exact: true }).click();
    await expect(page.getByText("Compliance policy published.", { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Compliance");
    await page.getByRole("tab", { name: "Policies", exact: true }).click();
    const policyCard = page.locator(".compliance-policy-card").filter({ hasText: policyTitle });
    await expect(policyCard).toBeVisible();
    await expect(policyCard).toContainText("Entire organisation");
    await expect(policyCard).toContainText("Active");
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Compliance");
    await expect(page.getByRole("heading", { name: "Compliance", exact: true })).toBeVisible();
    const policyCard = page.locator(".compliance-policy-card").filter({ hasText: policyTitle });
    await expect(policyCard).toBeVisible();
    await policyCard.getByRole("button", { name: "Acknowledge policy", exact: true }).click();
    await expect(page.getByText("Policy acknowledgement recorded.", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "My evidence", exact: true }).click();
    const evidenceCard = page.locator(".compliance-self-item").filter({ hasText: requirementTitle });
    await expect(evidenceCard).toContainText("No evidence submitted");
    await evidenceCard.getByRole("button", { name: "Submit evidence", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance evidence reference").fill(evidenceRef);
    await dialog.getByLabel("Compliance evidence note").fill("Stage 11 browser acceptance evidence");
    await dialog.getByLabel("Compliance evidence expiry date").fill(expiry);
    await dialog.getByRole("button", { name: "Submit evidence", exact: true }).click();
    await expect(page.getByText("Compliance evidence submitted.", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "My exceptions", exact: true }).click();
    const exceptionCard = page.locator(".compliance-self-item").filter({ hasText: requirementTitle });
    await exceptionCard.getByRole("button", { name: "Request exception", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance exception reason").fill("Temporary Stage 11 browser acceptance exception");
    await dialog.getByLabel("Compliance exception requested until").fill(requestedUntil);
    await dialog.getByRole("button", { name: "Request exception", exact: true }).click();
    await expect(page.getByText("Compliance exception requested.", { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Compliance");
    await expect(page.locator(".compliance-policy-card").filter({ hasText: policyTitle })).toContainText("Acknowledged");
    await page.getByRole("tab", { name: "My evidence", exact: true }).click();
    await expect(page.locator(".compliance-self-item").filter({ hasText: requirementTitle })).toContainText(evidenceRef);
    await page.getByRole("tab", { name: "My exceptions", exact: true }).click();
    await expect(page.locator(".compliance-self-item").filter({ hasText: requirementTitle })).toContainText("Requested");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Stage 11 Staff compliance overflowed the 390px viewport").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/stage11-compliance-staff-mobile.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Compliance");
    await page.getByRole("tab", { name: "Evidence", exact: true }).click();
    const evidenceRow = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(evidenceRow).toBeVisible();
    await expect(evidenceRow).toContainText(evidenceRef);
    await expect(evidenceRow.getByRole("button", { name: "Review evidence", exact: true })).toHaveCount(0);

    await page.getByRole("tab", { name: "Exceptions", exact: true }).click();
    const exceptionRow = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(exceptionRow).toBeVisible();
    await expect(exceptionRow.getByRole("button", { name: "Decide exception", exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "other@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Compliance");
    await page.getByRole("tab", { name: "Evidence", exact: true }).click();
    let row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await row.getByRole("button", { name: "Review evidence", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance evidence decision").selectOption("verified");
    await dialog.getByLabel("Compliance evidence reviewer note").fill("Acceptance evidence verified by Compliance");
    await dialog.getByRole("button", { name: "Record evidence decision", exact: true }).click();
    await expect(page.getByText("Evidence review recorded.", { exact: true })).toBeVisible();
    row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(row).toContainText("Verified");

    await page.getByRole("tab", { name: "Exceptions", exact: true }).click();
    row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await row.getByRole("button", { name: "Decide exception", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance exception decision", { exact: true }).selectOption("approved");
    await dialog.getByLabel("Compliance exception approved until").fill(approvedUntil);
    await dialog.getByLabel("Compliance exception decision note").fill("Acceptance exception approved temporarily");
    await dialog.getByRole("button", { name: "Record exception decision", exact: true }).click();
    await expect(page.getByText("Exception decision recorded.", { exact: true })).toBeVisible();

    row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(row).toContainText("Approved");
    await row.getByRole("button", { name: "Resolve exception", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Compliance exception decision note").fill("Acceptance exception resolved");
    await dialog.getByRole("button", { name: "Resolve exception", exact: true }).click();
    await expect(page.getByText("Exception decision recorded.", { exact: true })).toBeVisible();

    await page.reload();
    await go(page, "Compliance");
    await page.getByRole("tab", { name: "Evidence", exact: true }).click();
    row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(row).toContainText("Verified");
    await expect(row.getByText(/Evidence history · 2/)).toBeVisible();

    await page.getByRole("tab", { name: "Exceptions", exact: true }).click();
    row = page.locator(".row").filter({ hasText: "Staff Fixture" }).filter({ hasText: requirementTitle }).first();
    await expect(row).toContainText("Resolved");
    await expect(row.getByText(/Exception history · 3/)).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage11-compliance-operator.png", fullPage: true });
    await context.close();
  }

  await revokeOperator();

  {
    const { context, page } = await openAs(browser, "other@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Compliance");
    await expect(page.getByText(policyTitle, { exact: true })).toBeVisible();
    await expect(page.getByText("Staff Fixture", { exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 1280, height: 900 });
    await page.goto("/?tab=compliance");
    await expect(page.getByRole("heading", { name: "Compliance", exact: true })).toHaveCount(0);
    await context.close();
  }
  } finally {
    if(grantActive)await revokeOperator();
    await authority.auth.signOut({scope:"local"});
  }
});

test("Administration surfaces use policy-safe HR states and real employee records", async ({ browser }) => {
  test.setTimeout(240_000);
  test.setTimeout(150000);
  const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });

  await expect(page.locator(".adminv2-hero-title h1")).toContainText(/Good morning|Good afternoon|Good evening/);
  await expect(page.locator(".adminv2-context")).toContainText("Administration & HR");
  await expect(page.getByText("Needs Administration", { exact: true })).toBeVisible();
  await page.locator(".adminv2-more-context > summary").click();
  await expect(page.getByRole("heading", { name: "Finance & reporting", exact: true })).toBeVisible();
  await expect(page.getByText("Delivery signals", { exact: true })).toBeVisible();
  await expect(page.getByText("Administration could not finish loading", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add staff", exact: true })).toHaveCount(0);

  await go(page, "Units");
  await expect(page.getByRole("heading", { name: "Units", exact: true })).toBeVisible();
  const unitCard = page.getByRole("button", {name:"Open Test Unit A",exact:true});
  await expect(unitCard).toBeVisible();
  await unitCard.click();
  const unitWorkspace = page.getByRole("navigation", { name: "Unit workspace" });
  await expect(unitWorkspace).toBeVisible();
  await expect(unitWorkspace.getByRole("tab", { name: "Reporting", exact: true })).toBeVisible();
  await expect(unitWorkspace.getByRole("tab", { name: "Attendance", exact: true })).toBeVisible();
  await expect(unitWorkspace.getByRole("tab", { name: "Cost", exact: true })).toBeVisible();

  await unitWorkspace.getByRole("tab", { name: "People", exact: true }).click();
  await page.getByRole("button", { name: "Manage people & access", exact: true }).click();
  await expect(page.getByRole("heading", { name: "People & Access", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access administration", exact: true })).toBeVisible();
  await expect(page.getByLabel("Invitation unit", { exact: true })).toHaveValue("20000000-0000-4000-8000-000000000011");
  await page.getByRole("tab", { name: "Directory", exact: true }).click();
  await page.getByLabel("Find a person").fill("Staff Fixture");
  await page.getByRole("button", { name: /Staff Fixture/ }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  const peopleMain = page.getByRole("main");
  await expect(peopleMain.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Time & Leave", exact: true }).click();
  await expect(page.getByText(/active annual policy not configured/i)).toBeVisible();

  await page.getByRole("tab", { name: "Protected HR", exact: true }).click();
  await expect(peopleMain.getByRole("heading", { name: "Protected HR", exact: true })).toBeVisible();
  await expect(peopleMain.getByRole("button", { name: "Record salary", exact: true })).toBeVisible();
  await expect(peopleMain.getByRole("button", { name: "Record payment details", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Employment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Employment record", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Record change", exact: true }).click();
  const employmentDialog = page.getByRole("dialog");
  await expect(employmentDialog.getByRole("heading", { name: "Record employment change", exact: true })).toBeVisible();
  await employmentDialog.getByLabel("Change").selectOption("working_pattern_changed");
  await employmentDialog.getByLabel("Working pattern", { exact: true }).selectOption("flexible");
  await employmentDialog.getByLabel("Reason / context").fill("Acceptance employment history change");
  await employmentDialog.getByRole("button", { name: "Record employment change", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  // A recorded employment event may appear in both the current summary and the history timeline.
  // Require the exact event to be visible, without a strict-mode duplicate-text error.
  await expect(page.getByText("Working pattern changed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Acceptance employment history change", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "← All people", exact: true }).click();
  await page.getByLabel("Find a person").fill("Staff Fixture");
  await page.getByRole("button", { name: /Staff Fixture/ }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByText("Acceptance employment history change", { exact: true }).first()).toBeVisible();

  await go(page, "Employee lifecycle");
  await expect(page.getByRole("heading", { name: "Employee lifecycle", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start lifecycle case", exact: true }).click();
  const lifecycleDialog = page.getByRole("dialog", { name: "Start lifecycle case" });
  await lifecycleDialog.getByLabel("Lifecycle employee").selectOption("31000000-0000-4000-8000-000000000006");
  await lifecycleDialog.getByLabel("Lifecycle type").selectOption("onboarding");
  await lifecycleDialog.getByLabel("Lifecycle reason").fill("Acceptance onboarding lifecycle");
  await lifecycleDialog.getByRole("button", { name: "Start lifecycle case", exact: true }).click();
  await expect(page.getByText("Employee lifecycle case started.", { exact: true })).toBeVisible();
  for (let step = 1; step <= 4; step += 1) {
    await page.getByLabel("Lifecycle completion note").fill("Acceptance lifecycle step " + step);
    await page.getByRole("button", { name: "Complete current step", exact: true }).click();
    await expect(page.getByText("Lifecycle step completed.", { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText(/Same Unit Fixture · Onboarding/).first()).toBeVisible();
  await expect(page.getByText(/Completed · effective/).first()).toBeVisible();

  await go(page, "Protected HR");
  await expect(page.getByRole("heading", { name: "Protected HR", exact: true })).toBeVisible();
  await page.getByLabel("Protected HR employee").selectOption({ label: "Staff Fixture · staff@ceac.local.test" });
  await page.getByRole("button", { name: "Add protected record", exact: true }).click();
  const protectedDialog = page.getByRole("dialog", { name: "Add protected HR record" });
  await protectedDialog.getByLabel("Protected HR record type").selectOption("identifier");
  await protectedDialog.getByLabel("Identifier type").fill("Acceptance ID");
  await protectedDialog.getByLabel("Identifier value").fill("ACCEPTANCE-001");
  await protectedDialog.getByLabel("Protected HR reason").fill("Acceptance protected HR record");
  await protectedDialog.getByRole("button", { name: "Save protected record", exact: true }).click();
  await expect(page.getByText("Protected HR record saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("Acceptance ID", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ACCEPTANCE-001/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("ACCEPTANCE-001", { exact: true })).toBeVisible();

  await go(page, "Checks");
  await expect(page.getByRole("heading", { name: "Pending decisions", exact: true })).toBeVisible();
  const employmentWorkflow = page.getByRole("button", { name: /Review employment change/ }).first();
  await expect(employmentWorkflow).toBeVisible();
  await employmentWorkflow.click();
  await page.getByLabel("Check review note").fill("Acceptance workflow review");
  await expect(page.getByRole("button", { name: "Flag for follow-up", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm review", exact: true }).click();
  await expect(page.getByText("Check completed.", { exact: true })).toBeVisible();

  await go(page, "Authority");
  await expect(page.getByRole("heading", { name: "Access permissions", exact: true })).toBeVisible();
  await page.getByLabel("Authority person").selectOption({ label: "Staff Fixture · staff@ceac.local.test" });
  await page.getByRole("button", { name: "Add permission", exact: true }).click();
  const grantDialog = page.getByRole("dialog", { name: "Add permission" });
  await grantDialog.getByLabel("Capability", { exact: true }).selectOption("performance.admin");
  await grantDialog.getByLabel("Grant reason").fill("Acceptance temporary performance authority");
  await grantDialog.getByRole("button", { name: "Add permission", exact: true }).click();
  await expect(page.getByText("Capability granted.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove permission", exact: true }).click();
  const revokeDialog = page.getByRole("dialog", { name: "Remove permission" });
  await revokeDialog.getByLabel("Revocation reason").fill("Acceptance authority cleanup");
  await revokeDialog.getByRole("button", { name: "Remove permission", exact: true }).click();
  await expect(page.getByText("Capability revoked.", { exact: true })).toBeVisible();

  await go(page, "System rules");
  await expect(page.getByRole("heading", { name: "Organisation rules", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Work quiet days/ }).click();
  await page.getByRole("button", { name: "Record new version", exact: true }).click();
  const policyDialog = page.getByRole("dialog", { name: "Record new policy version" });
  await policyDialog.getByLabel("Policy rule value").fill("6");
  await policyDialog.getByLabel("Policy reason").fill("Acceptance policy rule version");
  await policyDialog.getByRole("button", { name: "Record new version", exact: true }).click();
  await expect(page.getByText("Policy rule recorded.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Work quiet days/ }).click();
  await page.getByRole("button", { name: "Show version history", exact: true }).click();
  await expect(page.locator(".ev2c-queue-row").filter({ hasText: "Acceptance policy rule version" })).toBeVisible();

  await go(page, "Connected Apps");
  await expect(page.getByRole("heading", { name: "Connected Apps", exact: true })).toBeVisible();
  const telegramCard = page.locator(".connected-provider-card").filter({ hasText: "Telegram" });
  await expect(telegramCard).toBeVisible();
  await expect(telegramCard.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(telegramCard.getByText("No connected account", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Integration connector name")).toHaveCount(0);
  await expect(page.getByLabel("Integration connector key")).toHaveCount(0);

  await telegramCard.getByRole("button", { name: "Connect", exact: true }).click();
  const connectedDialog = page.getByRole("dialog");
  const tokenInput = connectedDialog.getByLabel("Telegram bot token");
  await expect(tokenInput).toHaveAttribute("type", "password");
  await expect(connectedDialog.getByText(/stored encrypted in Supabase Vault/i)).toBeVisible();
  await expect(connectedDialog.getByRole("button", { name: "Verify & connect", exact: true })).toBeDisabled();
  await tokenInput.fill("123456:abcdefghijklmnopqrstuvwxyz123456");
  await connectedDialog.getByLabel("Telegram chat ID").fill("-100123456");
  await expect(connectedDialog.getByRole("button", { name: "Verify & connect", exact: true })).toBeEnabled();
  await connectedDialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Advanced diagnostics", exact: true }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  await expect(page.getByText("Retry / failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-artifacts/stage12-connected-apps-admin.png", fullPage: true });

  await go(page, "Audit");
  await expect(page.getByRole("heading", { name: "Activity history", exact: true })).toBeVisible();
  await expect(page.getByText("Recent changes", { exact: true })).toBeVisible();
  await expect(page.getByText(/Employment (Record · Update|History · Insert)/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Activity history", exact: true })).toBeVisible();

  await go(page, "Events");
  await expect(page.getByRole("heading", { name: "System events", exact: true })).toBeVisible();
  await expect(page.getByText("Event stream", { exact: true })).toBeVisible();
  await expect(page.getByText("Employment · Changed", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "System events", exact: true })).toBeVisible();

  await go(page, "Workforce");
  // The approved Stage 9 policy is active after the full 129-migration replay:
  // 24 days/year, 6 days per completed quarter, Manager then Administration.
  // Do not assert the old unconfigured prototype state or weaken any safeguards.
  await page.locator(".timeleave-policy > summary").filter({hasText:"Leave policy & balances"}).click();
  await expect(page.getByText("Confirmed leave process", { exact: true })).toBeVisible();
  await expect(page.getByText(/24-day yearly allowance comprises 15 annual-leave days/i)).toBeVisible();
  await expect(page.getByText(/Manager approval.*Administration final approval/i)).toBeVisible();
  await expect(page.getByText(/does not rank people, score attendance, infer absence from missing sessions/i)).toBeVisible();

  await go(page, "Control Center");
  await expect(page.getByRole("heading", { name: "Control Center", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Leave rules/ }).click();
  // The owner-confirmed 24-day process summary is guidance, not proof that
  // this synthetic organisation has completed a per-organisation policy record.
  // A fresh organisation has no active policy: don't invent entitlement data.
  await expect(page.getByText("Leave policy not configured", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage leave rules in Time & Leave", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage leave rules in Time & Leave", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Time & Leave", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Schedules & policy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Configure leave policy", exact: true })).toBeVisible();

  await go(page, "Settings");
  await page.getByRole("button", { name: /^Alerts & reminders/ }).click();
  await expect(page.getByRole("heading", { name: "Alerts & reminders", exact: true })).toBeVisible();

  const attentionRule = page.locator(".office-threshold-row").filter({ hasText: "active work has not moved for" });
  const attentionInput = attentionRule.locator("input");
  await attentionInput.fill("9");
  await attentionRule.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Attention rule updated", { exact: true })).toBeVisible();
  await page.reload();
  const reloadedRule = page.locator(".office-threshold-row").filter({ hasText: "active work has not moved for" });
  await expect(reloadedRule.locator("input")).toHaveValue("9");

  await page.getByRole("button", { name: "Back to Control Center", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Attendance & locations/ })).toBeVisible();

  await context.close();
});


test("Closure finance journey separates request, authority, evidence reference and actual spend", async ({ browser }) => {
  test.setTimeout(240000);
  const adminTitle = "Closure finance admin request";
  const execTitle = "Closure finance executive request";
  const adminEvidence = "Voucher CLOSURE-ADMIN-001";
  const execEvidence = "Voucher CLOSURE-EXEC-001";

  async function submitRequest(title, amount) {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await go(page, "Finance");
    await page.getByRole("button", { name: "Request funds", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Short request title").fill(title);
    await dialog.getByPlaceholder("Explain the need").fill("Closure corridor finance pressure test");
    await dialog.locator('input[inputmode="decimal"]').fill(amount);
    await dialog.getByRole("button", { name: "Submit request", exact: true }).click();
    await expect(page.getByText(/Finance request submitted/)).toBeVisible();
    await expect(page.locator(".row").filter({ hasText: title }).first()).toContainText("Awaiting decision");
    await context.close();
  }

  await submitRequest(adminTitle, "500.00");

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test");
    await go(page, "Finance");
    const request = page.locator(".finance-request-row").filter({ hasText: adminTitle }).first();
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "Review", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Finance decision note").fill("Administration approved closure request");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Finance request approved.", { exact: true })).toBeVisible();

    const fulfil = page.locator(".finance-fulfil-row").filter({ hasText: adminTitle }).first();
    await expect(fulfil).toBeVisible();
    await fulfil.getByRole("button", { name: "Record as spent", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Finance spend evidence reference").fill(adminEvidence);
    await dialog.getByRole("button", { name: "Record actual spend", exact: true }).click();
    await expect(page.getByText("Approved request recorded as actual spend.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await go(page, "Finance");
    await expect(page.locator(".row").filter({ hasText: adminTitle }).first()).toContainText("Fulfilled");
    await context.close();
  }

  await submitRequest(execTitle, "15000.00");

  {
    const { context, page } = await openAs(browser, "managerb@ceac.local.test");
    await go(page, "Finance");
    const request = page.locator(".finance-request-row").filter({ hasText: execTitle }).first();
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "Review", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Finance decision note").fill("Finance approved closure request");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText(/moved to its next authority/i)).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test");
    await go(page, "Finance");
    const request = page.locator(".finance-request-row").filter({ hasText: execTitle }).first();
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "Review", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Finance decision note").fill("Group Pastor approved closure request");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Finance request approved.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "managerb@ceac.local.test");
    await go(page, "Finance");
    const fulfil = page.locator(".finance-fulfil-row").filter({ hasText: execTitle }).first();
    await expect(fulfil).toBeVisible();
    await fulfil.getByRole("button", { name: "Record as spent", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Finance spend evidence reference").fill(execEvidence);
    await dialog.getByRole("button", { name: "Record actual spend", exact: true }).click();
    await expect(page.getByText("Approved request recorded as actual spend.", { exact: true })).toBeVisible();
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test");
    await go(page, "Finance");
    await page.getByRole("button", { name: "Money out", exact: true }).click();
    await expect(page.getByText(adminTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(execTitle, { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r7-closure-finance.png", fullPage: true });
    await context.close();
  }
});

test("Closure corridor preserves the Staff Fixture journey across CEAC OS", async ({ browser }) => {
  test.setTimeout(180000);

  {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Me");
    await page.getByRole("button", { name: /My work history/ }).click();
    await expect(page.getByText("Acceptance task — review loop", { exact: true })).toBeVisible();

    await go(page, "Home");
    await expect(page.locator(".staffv2").getByRole("button").filter({ hasText: "Acceptance unit meeting" })).toBeVisible();

    await go(page, "Team");
    await page.getByRole("button", { name: /Open room|Unit Room/ }).click();
    await expect(page.getByText("Room acceptance — confirm Sunday setup", { exact: true })).toBeVisible();

    await go(page, "Performance & development");
    await expect(page.getByText("Planning before execution", { exact: true })).toBeVisible();

    await go(page, "Learning");
    await expect(page.getByText("Acceptance Stage 8 Learning", { exact: true }).first()).toBeVisible();

    await go(page, "Compliance");
    await expect(page.getByText("Acceptance workplace safety policy", { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "My evidence", exact: true }).click();
    await expect(page.locator(".compliance-self-item").filter({ hasText: "Acceptance safety certificate" })).toContainText("Verified");
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test");
    await go(page, "People & Access");
    await page.getByLabel("Find a person").fill("Staff Fixture");
    await page.getByRole("button", { name: /Staff Fixture/ }).click();
    await page.getByRole("tab", { name: "History", exact: true }).click();
    await expect(page.getByText("Acceptance employment history change", { exact: true })).toBeVisible();

    await go(page, "Assets & devices");
    await expect(page.getByText("CEAC-ACCEPT-001", { exact: true }).first()).toBeVisible();

    await go(page, "Audit");
    await expect(page.getByText(/Employment (Record · Update|History · Insert)/).first()).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r7-closure-journey.png", fullPage: true });
    await context.close();
  }
});

test("Stage 12 Connected Apps keeps provider secrets server-bound on mobile", async ({ browser }) => {
  const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 390, height: 844 });
  await go(page, "Control Center");
  await expect(page.getByRole("heading", { name: "Control Center", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Connected apps/ }).click();
  await waitForRouteReady(page);
  await expect(page.getByRole("heading", { name: "Connected Apps", exact: true })).toBeVisible();

  const telegramCard = page.locator(".connected-provider-card").filter({ hasText: "Telegram" });
  await expect(telegramCard).toBeVisible();
  await expect(telegramCard.getByText("Not connected", { exact: true })).toBeVisible();
  await telegramCard.getByRole("button", { name: "Connect", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Telegram bot token")).toHaveAttribute("type", "password");
  await expect(dialog.getByText(/never saved in browser-visible CEAC tables/i)).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "Stage 12 Connected Apps overflowed the 390px viewport").toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/stage12-connected-apps-admin-mobile.png", fullPage: true });
  await context.close();
});

const administrationPhoneWidths = [320, 360, 375, 390, 414, 430];
const administrationPrimaryDestinations = ["Home", "Strategy", "Delivery", "Workload", "Assets & devices", "People", "Employee lifecycle", "Protected HR", "Workforce", "Reports", "Units", "Projects", "Calendar", "Cost", "Finance", "Audit", "Events", "Workflows", "Authority", "System rules", "Connected Apps", "Settings"];

for (const width of administrationPhoneWidths) {
  test(`Administration primary surfaces stay within the ${width}px phone width`, async ({ browser }) => {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width, height: 844 });

    for (const destination of administrationPrimaryDestinations) {
      await go(page, destination);
      await expect(page.locator(".body")).toBeVisible();
      const geometry = await page.evaluate(() => {
        const app = document.querySelector(".office-app")?.getBoundingClientRect();
        const body = document.querySelector(".office-app .body")?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          viewport: window.innerWidth,
          appLeft: app?.left ?? null,
          appRight: app?.right ?? null,
          bodyLeft: body?.left ?? null,
          bodyRight: body?.right ?? null,
        };
      });
      expect(geometry.overflow, `Administration / ${destination} overflowed at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.appLeft ?? 0), `Administration shell left a gap at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs((geometry.appRight ?? geometry.viewport) - geometry.viewport), `Administration shell left a right-side gap at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.bodyLeft ?? 0), `Administration body left a gap at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs((geometry.bodyRight ?? geometry.viewport) - geometry.viewport), `Administration body left a right-side gap at ${width}px`).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
}

test("Role shells stay within the phone viewport", async ({ browser }) => {
  const roles = [
    ["manager@ceac.local.test", ["Home", "Work", "Team", "Projects", "Delivery", "Workload"]],
    ["admin@ceac.local.test", ["Home", "People", "Workforce", "Reports"]],
    ["exec@ceac.local.test", ["Home", "Delivery", "Announcements", "Me"]],
  ];

  for (const [email, destinations] of roles) {
    const { context, page } = await openAs(browser, email, { width: 390, height: 844 });
    for (const destination of destinations) {
      await go(page, destination);
      await expect(page.locator(".body")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${email} / ${destination} overflowed the phone viewport`).toBeLessThanOrEqual(1);
    }
    await context.close();
  }
});


test("FPG6 Payroll gives Administration preparation and Executive protected review surfaces", async ({ browser }) => {
  test.setTimeout(120000);
  const payrollLabel = "FPG6 July 2026 Payroll";

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "Payroll");
    await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();
    await expect(page.getByText("Administration prepares", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Create payroll run", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Period label").fill(payrollLabel);
    await dialog.getByLabel("Period start").fill("2026-07-01");
    await dialog.getByLabel("Period end").fill("2026-07-31");
    await dialog.getByLabel("Currency").selectOption("GHS");
    await dialog.getByLabel("Preparation note").fill("FPG6 visual acceptance fixture");
    await dialog.getByRole("button", { name: "Create draft Payroll", exact: true }).click();

    await expect(page.getByText("Draft payroll run created from salary-eligible protected employee records. Active volunteers remain outside ordinary salary payroll.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: payrollLabel, exact: true })).toBeVisible();
    await expect(page.locator(".fpg-payroll-table")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/fpg6-payroll-admin-desktop.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test", { width: 390, height: 844 });
    await go(page, "Payroll");
    await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();
    await expect(page.getByText("Group Pastor approves", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: payrollLabel, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create payroll run", exact: true })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/fpg6-payroll-executive-mobile.png", fullPage: true });
    await context.close();
  }
});


test("FPG7 People and Workforce follow the locked employee-management reference without invented HR data", async ({ browser }) => {
  test.setTimeout(120000);

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 1280, height: 900 });
    await go(page, "People & Access");
    await expect(page.getByRole("heading", { name: "People & Access", exact: true })).toBeVisible();
    await expect(page.locator(".pp-directory-rail")).toBeVisible();
    await expect(page.locator(".fpg-people-roster-row").first()).toBeVisible();
    await page.screenshot({ path: "test-artifacts/fpg7-people-roster-desktop.png", fullPage: true });

    await go(page, "Workforce");
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Planned absences", exact: true })).toBeVisible();
    await expect(page.locator(".fpg-absence-board")).toBeVisible();
    await expect(page.getByLabel("Workforce calendar unit filter")).toBeVisible();
    await expect(page.getByLabel("Workforce calendar person filter")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/fpg7-workforce-absence-desktop.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 390, height: 844 });
    await go(page, "People & Access");
    await expect(page.locator(".pp-directory-rail")).toBeVisible();
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await go(page, "Workforce");
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await expect(page.locator(".fpg-absence-scroll")).toBeVisible();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/fpg7-people-workforce-mobile.png", fullPage: true });
    await context.close();
  }
});


test("FPG9 Manager Home and shell follow the locked original CEAC reference", async ({ browser }) => {
  test.setTimeout(120000);

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1440, height: 900 });
    await expect(page.locator(".ev2s-sidebar")).toBeVisible();
    await expect(page.locator(".fpg9-sidebar-quick")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open messages", exact: true })).toBeVisible();
    await expect(page.locator(".fpg9-home-hero")).toBeVisible();
    await expect(page.locator(".fpg9-next-card")).toBeVisible();
    await expect(page.locator(".fpg9-schedule-card")).toBeVisible();
    await expect(page.locator(".fpg9-calendar-card")).toBeVisible();
    await expect(page.locator(".fpg9-attention-card")).toBeVisible();
    await expect(page.locator(".fpg9-waiting-card")).toBeVisible();
    await expect(page.locator(".fpg9-coming-card")).toBeVisible();
    await expect(page.locator(".fpg9-module-strip")).toBeVisible();
    await expect(page.locator(".fpg9-workspace-previews")).toBeVisible();
    await expect(page.locator(".managerv2-decisions")).toHaveCount(0);
    await page.screenshot({ path: "test-artifacts/fpg9-manager-home-shell-desktop.png", fullPage: true });
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 390, height: 844 });
    await expect(page.locator(".ev2s-sidebar")).toBeHidden();
    await expect(page.locator(".fpg9-home-hero")).toBeVisible();
    await expect(page.locator(".fpg9-home-reference")).toBeVisible();
    await expect(page.locator(".fpg9-mobile-shortcuts")).toBeVisible();
    await expect(page.locator(".fpg9-calendar-card")).toBeHidden();
    await expect(page.locator(".fpg9-module-strip")).toBeHidden();
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.height).toBeLessThanOrEqual(1300);
    await page.screenshot({ path: "test-artifacts/fpg9-manager-home-shell-mobile.png", fullPage: true });
    await context.close();
  }
});


test("FPG10 propagates the accepted Work, Finance and People reference grammar across roles", async ({ browser }) => {
  test.setTimeout(180000);
  const checks = [
    ["staff@ceac.local.test", [["Work", ".ev2-work-page"]]],
    ["manager@ceac.local.test", [["Work", ".ev2-work-page"], ["Team", ".ev2-people-page"], ["Finance", ".ev2-finance-page"]]],
    ["admin@ceac.local.test", [["Work", ".ev2-work-page"], ["People", ".pp-directory-rail"], ["Finance", ".fpg-finance-dashboard"]]],
    ["exec@ceac.local.test", [["Work", ".ev2-work-page"], ["Finance", ".ev2-finance-page"]]],
  ];
  for (const [email, surfaces] of checks) {
    const { context, page } = await openAs(browser, email, { width: 1366, height: 768 });
    for (const [route, selector] of surfaces) {
      await go(page, route);
      await expect(page.locator(selector).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    const role = email.split("@")[0];
    await page.screenshot({ path: `test-artifacts/fpg10-${role}-propagation.png`, fullPage: true });
    await context.close();
  }
});

test("Foundation People & Access keeps new invitations distinct from existing responsibilities", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const {context,page}=await openAs(browser,"admin@ceac.local.test",viewport);
    await go(page,"People & Access");
    await expect(page.getByRole("heading",{name:"People & Access",exact:true})).toBeVisible();
    await page.getByRole("tablist",{name:"People views"}).getByRole("tab",{name:/^Access(?: administration)?$/}).click();
    await expect(page.locator(".phase5-people-access")).toBeVisible();
    await expect(page.getByRole("button",{name:"Send Staff invitation"})).toBeDisabled();
    await page.screenshot({path:`test-artifacts/foundation-people-access-invite-${viewport.width}.png`,fullPage:true});
    await page.locator(".phase5-people-access").getByRole("tab",{name:"Responsibilities",exact:true}).click();
    await expect(page.getByRole("combobox",{name:"Existing person",exact:true})).toBeVisible();
    await page.getByRole("combobox",{name:"Existing person",exact:true}).selectOption("31000000-0000-4000-8000-000000000002");
    await expect(page.getByRole("button",{name:"End membership"}).first()).toBeVisible();
    await expect(page.getByRole("button",{name:"Record responsibility"})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`test-artifacts/foundation-people-access-responsibility-${viewport.width}.png`,fullPage:true});
    await context.close();
  }
});
