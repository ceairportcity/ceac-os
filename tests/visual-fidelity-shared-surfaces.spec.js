import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signIn(browser, { email, app, route, viewport }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout: 15000 });
  await page.goto(route);
  await expect(page.locator(".body,.msg-workspace")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("VF6D keeps Messages and Connected Apps factual while closing shared-surface drift", async ({ browser }) => {
  test.setTimeout(120000);
  const inbox = readFileSync("src/screens/Inbox.jsx", "utf8");
  const staffCss = readFileSync("src/premium-staff.css", "utf8");
  const integrationCss = readFileSync("src/experience-v2/integrations/integrations.css", "utf8");
  const integrations = readFileSync("src/screens/AdminIntegrations.jsx", "utf8");

  expect(inbox).not.toContain('className="premium-surface inbox-list"');
  expect(inbox).toContain('aria-label="Messages sections"');
  expect(inbox).toContain('supabase.rpc("my_room_directory")');
  const messagesCss=readFileSync("src/screens/MessagesWorkspace.css","utf8");
  expect(messagesCss).toContain(".msg-layout");
  expect(messagesCss).toContain(".memo-compose");
  expect(integrationCss).toContain("/* VF6D — Connected Apps operational-surface closure.");
  expect(integrationCss).not.toContain("!important");
  expect(integrations).toContain('type="password"');
  expect(integrations).toContain("never saved in browser-visible CEAC tables");
  expect(integrations).toContain("Provider permissions never broaden CEAC OS authority");

  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "laptop-1366", width: 1366, height: 768 },
  ]) {
    for (const role of [
      { key: "staff", email: "staff@ceac.local.test", app: ".staff-app" },
      { key: "manager", email: "manager@ceac.local.test", app: ".manager-app" },
      { key: "administration", email: "admin@ceac.local.test", app: ".office-app" },
      { key: "executive", email: "exec@ceac.local.test", app: ".executive-app" },
    ]) {
      const { context, page } = await signIn(browser, {
        email: role.email,
        app: role.app,
        route: "/?tab=messages",
        viewport: { width: viewport.width, height: viewport.height },
      });
      const inboxPage = page.locator(".msg-workspace");
      await expect(inboxPage.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
      const filters = inboxPage.getByRole("navigation", { name: "Messages sections", exact: true }).getByRole("button");
      await expect(filters).toHaveCount(2);
      await expect(filters.filter({hasText:/^Rooms$/})).toHaveCount(1);
      await expect(filters.filter({hasText:/^Memos$/})).toHaveCount(1);
      const heights = await filters.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      await expect(inboxPage.getByRole("searchbox",{name:"Search Rooms"})).toBeVisible();
      await expect(inboxPage.getByRole("button",{name:"Direct Messages",exact:true})).toHaveCount(0);
      const queuePanel=inboxPage.locator(".msg-conversation");
      const queueStyle=await queuePanel.evaluate(node=>({shadow:getComputedStyle(node).boxShadow,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
      expect(queueStyle.shadow).toBe("none");
      expect(queueStyle.overflow).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-artifacts/vf6d-${role.key}-messages-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    }

    {
      const { context, page } = await signIn(browser, {
        email: "admin@ceac.local.test",
        app: ".office-app",
        route: "/?tab=integrations",
        viewport: { width: viewport.width, height: viewport.height },
      });
      const connected = page.locator(".connected-apps");
      await expect(connected.getByRole("heading", { name: "Connected Apps", exact: true })).toBeVisible();

      const grid = connected.locator(".ev2i-provider-grid");
      const card = connected.locator(".connected-provider-card").first();
      await expect(card).toBeVisible();
      const geometry = await Promise.all([
        grid.boundingBox(),
        card.boundingBox(),
      ]);
      expect(geometry[0]?.width || 0).toBeGreaterThan(0);
      expect(geometry[1]?.width || 0).toBeGreaterThan(0);
      if ((await connected.locator(".connected-provider-card").count()) === 1 && viewport.width >= 1000) {
        expect((geometry[1]?.width || 0) / (geometry[0]?.width || 1)).toBeGreaterThan(0.9);
      }

      const facts = card.locator(".ev2i-provider-facts");
      const columns = await facts.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length);
      expect(columns).toBe(viewport.width >= 1000 ? 4 : 1);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: `test-artifacts/vf6d-admin-connected-apps-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    }
  }
});
