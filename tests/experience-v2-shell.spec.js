import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const password = process.env.ROLE_FIXTURE_PASSWORD;

test.describe.configure({ mode: "serial" });

test("Stage 4B shell is isolated, tokenized and wired through App", async () => {
  for (const path of [
    "src/experience-v2/shell/navigation.js",
    "src/experience-v2/shell/ShellV2.jsx",
    "src/experience-v2/shell/GlobalSearch.jsx",
    "src/experience-v2/shell/shell.css",
    "src/experience-v2/shell/index.js",
  ]) {
    expect(fs.existsSync(path), path).toBeTruthy();
  }

  const shell = fs.readFileSync("src/experience-v2/shell/ShellV2.jsx", "utf8");
  const globalSearch = fs.readFileSync("src/experience-v2/shell/GlobalSearch.jsx", "utf8");
  const navigation = fs.readFileSync("src/experience-v2/shell/navigation.js", "utf8");
  const css = fs.readFileSync("src/experience-v2/shell/shell.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");

  expect(shell).toContain('from "../icons"');
  expect(shell).toContain("Drawer");
  expect(shell).toContain("PopoverMenu");
  expect(shell).toContain("getShellQuickActions");
  expect(shell).toContain('import("./GlobalSearch")');
  expect(globalSearch).toContain("searchCeacRecords");
  expect(globalSearch).toContain("Search CEAC…");
  expect(globalSearch).not.toContain("Find a destination…");
  expect(shell).toContain("ev2s-sidebar-main");
  expect(shell).not.toContain("function createMenuItems");
  expect(shell).not.toContain("components/primitives/Icon");
  expect(shell).not.toContain("components/PremiumShell");

  expect(navigation).toContain('capability: "people.manage"');
  expect(navigation).toContain("const ROLE_QUICK_ACTIONS");
  expect(navigation).toContain("export function getShellQuickActions");
  expect(navigation).not.toContain('key: "primitives"');

  expect((css.match(/!important\b/g) || []).length).toBe(0);
  for (const forbidden of [
    ".staff-app",
    ".manager-app",
    ".office-app",
    ".executive-app",
    ".premium-side",
    ".premium-topbar",
    ".premium-tabs",
  ]) {
    expect(css.includes(forbidden), forbidden).toBeFalsy();
  }
  expect(css).toContain("background: var(--ev2-surface);");
  expect(css).toContain("var(--ev2-action)");
  expect(css).toContain("var(--ev2-control-min)");

  expect(app).toContain('from "./experience-v2/shell"');
  expect(app).not.toContain('from "./components/PremiumShell"');
  expect(app).not.toContain('className="app-workspace"');
  expect(app).not.toContain('className="mobile-unit-switch"');
  expect(app).toContain("onCreateWork={(isManager || isExec)");

  const componentCss = main.indexOf('import "./experience-v2/components/components.css";');
  const shellCss = main.indexOf('import "./experience-v2/shell/shell.css";');
  expect(componentCss).toBeGreaterThan(-1);
  expect(shellCss).toBeGreaterThan(componentCss);
});

async function signIn(page, email) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

test("Stage 4B desktop shell exposes only authorised production destinations", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");

  const sidebar = page.locator(".ev2s-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "People & Access", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Time & Leave", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Control Center", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Primitives", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Search CEAC…")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector(".ev2s-sidebar-nav");
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarOverflow: document.querySelector(".ev2s-sidebar")?.scrollWidth - document.querySelector(".ev2s-sidebar")?.clientWidth,
      navOverflowY: nav ? getComputedStyle(nav).overflowY : "",
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.sidebarOverflow).toBeLessThanOrEqual(1);
  expect(["auto", "scroll"]).toContain(geometry.navOverflowY);
});

test("Manager shell exposes Time & Leave as a first-class destination", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "manager@ceac.local.test");

  const sidebar = page.locator(".ev2s-sidebar");
  const timeLeave = sidebar.getByRole("button", { name: "Time & Leave", exact: true });
  await expect(timeLeave).toBeVisible();
  await timeLeave.click();
  await expect(page.locator(".ev2-workforce-manager")).toBeVisible({ timeout: 15000 });
  await page.locator(".timeleave-policy > summary").click();
  await expect(page.getByText("Manager approval → Administration final approval", { exact: false }).first()).toBeVisible();
});

test("Stage 4B create menu exposes only role-authorised shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "staff@ceac.local.test");

  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(create).toBeVisible();
  await create.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "New work", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Announcement", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Meeting", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Message room", exact: true })).toBeVisible();
});

test("OCR2 Executive creation is reachable through the approved Work, Ministry and Announcements destinations", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "exec@ceac.local.test");
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeHidden();

  await page.goto("/?tab=work");
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Give out work", exact: true }).first()).toBeVisible();

  await page.goto("/?tab=strategy");
  await expect(page.getByRole("heading", { name: "Ministry goals", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Set first ministry priority", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add ministry priority" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Strategy name")).toBeVisible();

  await page.goto("/?tab=announcements");
  await page.getByRole("button", { name: "New announcement", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "New announcement" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Attachments", { exact: true })).toBeVisible();
});

test("OCR3 authorised Administration Create exposes Announcement while Staff remains excluded", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");
  const create = page.getByRole("button", { name: "Create", exact: true });
  await create.click();
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "Announcement", exact: true })).toBeVisible();
});

test("OCR6C Executive Messages chooses an authorised Sub-team before communicating", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "exec@ceac.local.test");
  await page.goto("/?tab=messages");
  await expect(page).toHaveURL(/tab=messages/);
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  // Wait for the lazy-loaded Messages route and its session-scoped data to
  // settle before exercising its segmented control. A shell mount alone is
  // not a loaded Messages page and can otherwise race a route replacement.
  const messages = page.locator(".msg-workspace");
  await expect(messages.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(messages.getByText("Loading Rooms…", { exact: true })).toBeHidden({ timeout: 15000 });
  const roomsTab = messages.getByRole("navigation",{name:"Messages sections"}).getByRole("button", { name: "Rooms", exact: true });
  await expect(roomsTab).toBeVisible();
  await roomsTab.click();
  await expect(roomsTab).toHaveAttribute("aria-current", "page");
  const roomDirectory = page.getByRole("complementary",{name:"Rooms",exact:true});
  await expect(roomDirectory).toBeVisible();
  await expect(page.getByRole("searchbox",{name:"Search Rooms"})).toBeVisible();

  const subTeam = roomDirectory.locator("button.msg-row").filter({ hasText: "Fixture Video Team" }).first();
  await expect(subTeam).toBeVisible();
  await subTeam.click();
  await expect(page.getByText("Sub-team Room", { exact: true })).toBeVisible();
  const message = "OCR6 executive sub-team message";
  await page.getByPlaceholder("Message Fixture Video Team").fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});

test("OCR6C Executive Create publishes an Announcement and records a Ministry Objective", async ({ page }) => {
  test.setTimeout(120000);
  const announcementTitle = "OCR6 operational clarity announcement";
  const directionTitle = "OCR6 ministry direction";
  const objectiveTitle = "OCR6 ministry objective";

  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "exec@ceac.local.test");

  // The approved Executive shell has no generic Create popup.
  // Publishing remains available from its authorised Announcements surface.
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeHidden();
  await page.goto("/?tab=announcements");
  await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New announcement", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New announcement" });
  await dialog.locator("#announcement-title").fill(announcementTitle);
  await dialog.locator("#announcement-body").fill("Operational Clarity final workflow acceptance.");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).toBeHidden();
  const announcementRow = page.locator(".row").filter({ hasText: announcementTitle }).first();
  await expect(announcementRow).toBeVisible();
  await announcementRow.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(announcementRow.getByText(/published/i)).toBeVisible();

  await page.goto("/?tab=strategy");
  await expect(page.getByRole("heading", { name: "Ministry goals", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Set first ministry priority", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Add ministry priority" });
  await dialog.getByLabel("Strategy name").fill(directionTitle);
  await dialog.getByLabel("Strategy statement").fill("Provide an attributable parent direction for OCR6 acceptance.");
  await dialog.getByLabel("Strategy change reason").fill("OCR6 final workflow acceptance.");
  await dialog.getByRole("button", { name: "Add ministry priority", exact: true }).click();
  await expect(page.getByText(directionTitle, { exact: true })).toBeVisible();

  // The ministry-specific composer enforces the same parent-direction
  // authority, without reintroducing the retired global Create button.
  await page.goto("/?tab=strategy");
  await page.getByRole("heading", { name: "Ministry goals", exact: true }).waitFor();
  await page.getByRole("button", { name: "Add ministry goal", exact: true }).first().click();
  dialog = page.getByRole("dialog", { name: "Add ministry goal" });
  await dialog.getByLabel("Strategy parent direction").selectOption({ label: directionTitle });
  await dialog.getByLabel("Strategy name").fill(objectiveTitle);
  await dialog.getByLabel("Strategy statement").fill("Prove the compact Executive ministry objective Composer.");
  await dialog.getByText(/Why are you adding or changing this/).first().click();
  await dialog.getByLabel("Strategy change reason").fill("OCR6 final workflow acceptance.");
  await dialog.getByRole("button", { name: "Add ministry goal", exact: true }).click();
  await expect(page.getByText(objectiveTitle, { exact: true })).toBeVisible();
});

test("OCR3 Room Composer exposes private media attachment control", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "manager@ceac.local.test");
  const create = page.getByRole("button", { name: "Create", exact: true });
  await create.click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Message room", exact: true }).click();
  await expect(page.locator(".room-screen")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Attach file", exact: true })).toBeVisible();
  await expect(page.locator('.room-composer input[type="file"]')).toHaveAttribute("accept", /image/);
});

test("OCR4 Global Search returns grouped authorised records and opens Project and Work", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  // Prove the same Manager identity has the exact source row under real RLS
  // before starting the browser's sole authoritative auth session. A separate
  // preflight sign-in after browser login can invalidate its session in some
  // GoTrue configurations, making a correct search appear unauthorised.
  // The global search must never silently convert an authorisation/SQL failure
  // into a misleading empty result; diagnostics do not spoof any API response.
  const authorised = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth:{persistSession:false},
  });
  const managerAuth = await authorised.auth.signInWithPassword({
    email:"manager@ceac.local.test", password:process.env.ROLE_FIXTURE_PASSWORD,
  });
  expect(managerAuth.error, "Manager browser fixture must also authenticate for exact RLS preflight").toBeNull();
  const verifiedWork = await authorised.from("work_items").select("id,title")
    .eq("id","26000000-0000-4000-8000-000000000011");
  expect(verifiedWork.error, "Manager-authorised source Work search must not be silently denied").toBeNull();
  expect(verifiedWork.data, "Manager should see its own unit's seeded predecessor work").toHaveLength(1);
  // Close the isolated preflight session before starting browser authentication.
  const preflightClosed = await authorised.auth.signOut({ scope: "local" });
  expect(preflightClosed.error).toBeNull();


  await signIn(page, "manager@ceac.local.test");

  const search = page.getByPlaceholder("Search CEAC…");
  await search.fill("Stage 4 Browser Project");
  const results = page.getByRole("dialog", { name: "Search CEAC results" });
  await expect(results).toBeVisible();
  const projects = results.locator('.ev2s-search-group[aria-label="Projects"]');
  await expect(projects.getByRole("button", { name: /Stage 4 Browser Project/ })).toBeVisible();
  await projects.getByRole("button", { name: /Stage 4 Browser Project/ }).click();
  await expect(page).toHaveURL(/tab=projects.*project=25000000-0000-4000-8000-000000000011/);
  await expect(page.locator(".ev2-project-workspace")).toBeVisible({ timeout: 15000 });

  await page.goto("/?tab=home");
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  const searchAgain = page.getByPlaceholder("Search CEAC…");
  await searchAgain.fill("Stage 5 predecessor work");
  // The same browser session must read every Work column required by Search.
  const browserWork = await page.evaluate(async () => {
    const { supabase } = await import("/src/lib/supabase.js");
    const { data, error } = await supabase.from("work_items")
      .select("id,ref,title,status,project_id")
      .eq("id", "26000000-0000-4000-8000-000000000011");
    return { rows: data?.length || 0, error: error?.message || null };
  });
  expect(browserWork.error, "Browser-authenticated Work lookup must not fail silently").toBeNull();
  expect(browserWork.rows, "Browser should see the Work row under real RLS").toBe(1);
  const work = page.getByRole("dialog", { name: "Search CEAC results" }).locator('.ev2s-search-group[aria-label="Work"]');
  await expect(work.getByRole("button", { name: /Stage 5 predecessor work/ })).toBeVisible();
  await work.getByRole("button", { name: /Stage 5 predecessor work/ }).click();
  await expect(page.locator(".ev2-work-detail")).toBeVisible({ timeout: 15000 });
});

test("OCR6C Global Search opens authorised People and Announcement records", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");

  let search = page.getByPlaceholder("Search CEAC…");
  await search.fill("Staff Fixture");
  let results = page.getByRole("dialog", { name: "Search CEAC results" });
  const people = results.locator('.ev2s-search-group[aria-label="People"]');
  await expect(people.getByRole("button", { name: /Staff Fixture/ })).toBeVisible();
  await people.getByRole("button", { name: /Staff Fixture/ }).click();
  await expect(page.getByRole("heading", { name: "Staff Fixture", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("tablist", { name: "Employee record sections" })).toBeVisible();

  await page.locator(".ev2s-sidebar").getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".adminv2-main")).toBeVisible({ timeout: 15000 });
  search = page.getByPlaceholder("Search CEAC…");
  await search.fill("Test Unit A");
  results = page.getByRole("dialog", { name: "Search CEAC results" });
  await expect(results.locator('.ev2s-search-group[aria-label="Organisation"]').getByRole("button", { name: /Test Unit A/ })).toBeVisible();

  await search.fill("announcement");
  results = page.getByRole("dialog", { name: "Search CEAC results" });
  await expect(results.locator('.ev2s-search-group[aria-label="Actions"]').getByRole("button", { name: "Announcement", exact: true })).toBeVisible();
  await expect(results.locator('.ev2s-search-group[aria-label="Destinations"]').getByRole("button", { name: "Announcements", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Announcement", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New announcement" });
  // Set a real, explicit authorised audience instead of relying on the
  // draft composer's prior/default state after the Global Search overlay.
  await dialog.getByRole("button", { name: "Everyone", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Everyone", exact: true })).toHaveClass(/is-active/);
  await dialog.locator("#announcement-title").fill("OCR6 Search Announcement");
  await dialog.locator("#announcement-body").fill("OCR6 searchable announcement record");
  // This still exercises an actual authorised Save Draft, not a mocked result.
  const saveDraft = dialog.getByRole("button", { name: "Save draft", exact: true });
  await expect(saveDraft).toBeEnabled();
  await saveDraft.click();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder("Search CEAC…").fill("OCR6 Search Announcement");
  results = page.getByRole("dialog", { name: "Search CEAC results" });
  const announcements = results.locator('.ev2s-search-group[aria-label="Announcements"]');
  const announcement = announcements.getByRole("button", { name: /OCR6 Search Announcement/ });
  await expect(announcement).toBeVisible();
  await announcement.click();
  await expect(page.getByText("OCR6 searchable announcement record", { exact: true })).toBeVisible({ timeout: 15000 });
});

test("OCR6C Organisation search remains available while an unrelated authorised catalogue is pending", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");
  await expect(page.locator(".adminv2-main")).toBeVisible({ timeout: 15000 });

  // The local seed supplies Test Unit A and the Administration identity in
  // the same organisation. Hold only the optional meeting-catalogue HTTP
  // response: Organisation still must resolve from its own real RLS query.
  let releaseMeetings;
  const heldMeetings = new Promise((resolve) => { releaseMeetings = resolve; });
  await page.route("**/rest/v1/meeting_sessions?*", async (route) => {
    await heldMeetings;
    // The application may cancel a superseded search request while the
    // optional catalogue is held. Do not resolve a canceled route twice.
    try {
      await route.continue();
    } catch (error) {
      // A superseded optional request may already have been canceled.
      if (!String(error).includes("already handled")) throw error;
    }
  });
  try {
    await page.getByPlaceholder("Search CEAC…").fill("Test Unit A");
    const results = page.getByRole("dialog", { name: "Search CEAC results" });
    await expect(results.locator('.ev2s-search-group[aria-label="Organisation"]')
      .getByRole("button", { name: /Test Unit A/ })).toBeVisible({ timeout: 15000 });
    await expect(results.getByText(/Organisation search could not be verified/i)).toBeHidden();
  } finally {
    releaseMeetings?.();
    await page.unroute("**/rest/v1/meeting_sessions?*");
  }
});

test("OCR6C Project Files upload is searchable and opens through a signed private URL", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "manager@ceac.local.test");
  await page.goto("/?tab=projects&project=25000000-0000-4000-8000-000000000011");
  await expect(page.locator(".ev2-project-workspace")).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: /^Files/ }).click();

  const filename = "ocr6-private-search.txt";
  const input = page.locator('.operational-files input[type="file"]');
  // The private-file panel verifies the current Project before enabling writes.
  // Sending a synthetic file before that read completes can drop the change.
  // Wait for the actual authorised upload state; do not mock file/storage success.
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.setInputFiles({ name: filename, mimeType: "text/plain", buffer: Buffer.from("OCR6 private search fixture") });
  await expect(page.getByText(filename, { exact: true })).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("Search CEAC…").fill(filename);
  const results = page.getByRole("dialog", { name: "Search CEAC results" });
  const files = results.locator('.ev2s-search-group[aria-label="Files"]');
  const fileResult = files.getByRole("button", { name: new RegExp(filename.replace(".", "\\.")) });
  await expect(fileResult).toBeVisible({ timeout: 15000 });
  const popupPromise = page.waitForEvent("popup");
  await fileResult.click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toContain("/storage/v1/object/sign/");
  await popup.close();
});

test("OCR4 mobile Search CEAC opens as a full-screen search surface", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "staff@ceac.local.test");
  await page.getByRole("button", { name: "Search CEAC", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Search CEAC" });
  await expect(drawer).toBeVisible();
  await drawer.getByPlaceholder("Search CEAC…").fill("Stage 5 predecessor work");
  await expect(drawer.locator('.ev2s-search-group[aria-label="Work"]').getByRole("button", { name: /Stage 5 predecessor work/ })).toBeVisible({ timeout: 15000 });
  const box = await drawer.boundingBox();
  expect(box?.width || 0).toBeGreaterThanOrEqual(389);
  expect(box?.height || 0).toBeGreaterThanOrEqual(840);
});

test("Stage 4B mobile shell keeps five controls and uses the shared More drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "staff@ceac.local.test");

  await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
  const mobileNav = page.locator(".ev2s-mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("button")).toHaveCount(5);

  await mobileNav.getByRole("button", { name: "More", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "More" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Calendar", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Time & Leave", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Messages", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Your account", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(mobileNav.getByRole("button", { name: "More", exact: true })).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});


test("P7 desktop and phone shell render accessible approved white-blue surfaces",async({page})=>{
 await page.setViewportSize({width:1440,height:960});
 await signIn(page,"staff@ceac.local.test");
 await expect(page.locator(".ev2s-sidebar")).toBeVisible();
 const desktop=await page.evaluate(()=>{
   const shell=document.querySelector(".ev2s-sidebar");
   const active=shell.querySelector(".ev2s-sidebar-nav button.is-active");
   return {
     surface:getComputedStyle(shell).backgroundColor,
     activeSurface:getComputedStyle(active).backgroundColor,
     activeText:getComputedStyle(active).color,
     overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   };
 });
 expect(desktop.surface).toBe("rgb(255, 255, 255)");
 expect(desktop.activeSurface).toBe("rgb(234, 241, 255)");
 expect(desktop.activeText).toBe("rgb(20, 88, 184)");
 expect(desktop.overflow).toBeLessThanOrEqual(1);
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
 const mobile=await page.evaluate(()=>{
   const top=getComputedStyle(document.querySelector(".ev2s-mobile-topbar"));
   return {
     surface:top.backgroundColor,
     text:top.color,
     overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   };
 });
 expect(mobile.surface).toBe("rgba(255, 255, 255, 0.98)");
 expect(mobile.text).toBe("rgb(23, 35, 45)");
 expect(mobile.overflow).toBeLessThanOrEqual(1);
});
