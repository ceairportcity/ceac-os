import { test, expect } from "@playwright/test";

const report = {
  id:"reported-1", org_id:"synthetic-org", reporter_id:"person",
  category:"Camera", manufacturer:"Canon", model:"R7",
  serial_number:"STAFF-100", reported_asset_tag:"CAM-STAFF-01",
  current_location:"Media office", condition_note:"Working normally",
  details:"Received from equipment desk", status:"pending",
  created_at:"2026-11-16T10:00:00Z", asset_id:null,
};
for (const width of [390, 1440]) {
  test("Staff can report missing equipment but cannot create official assets at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const writes = [];
    await page.route("**/*", route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.includes("/rest/v1/")) return ["localhost","127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
      const table = url.pathname.split("/").pop();
      if (req.method() !== "GET") {
        writes.push({ table, body:req.postDataJSON() });
        return route.fulfill({ status:403, contentType:"application/json", body:JSON.stringify({message:"Synthetic report denied"}) });
      }
      const rows = {asset_items:[],asset_assignment_events:[],asset_lifecycle_events:[],asset_staff_reports:[report]};
      return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(rows[table] || []) });
    });
    await page.goto("/tests/fixtures/hr-overview-review.html?audit=screen&screen=assets&actor=staff");
    await expect(page.getByText("Equipment missing from your record?")).toBeVisible();
    await expect(page.getByText("Awaiting HR verification")).toBeVisible();
    await page.getByRole("button",{name:"Report equipment",exact:true}).click();
    const dialog = page.getByRole("dialog",{name:"Report equipment to HR"});
    await dialog.getByLabel("Reported equipment type").fill("Laptop");
    await dialog.getByRole("button",{name:"Send report to HR"}).click();
    await expect(dialog).toContainText("Synthetic report denied");
    await expect(dialog.getByLabel("Reported equipment type")).toHaveValue("Laptop");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({table:"asset_submit_staff_report",body:{p_category:"Laptop"}});
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });

  test("HR sees incoming reports and alone can record official assignment at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const writes = [];
    await page.route("**/*", route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.includes("/rest/v1/")) return ["localhost","127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
      const table = url.pathname.split("/").pop();
      if (req.method() !== "GET") {
        writes.push({table,body:req.postDataJSON()});
        return route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({message:"Synthetic verification denied"})});
      }
      const rows = {asset_items:[],asset_assignment_events:[],asset_lifecycle_events:[],
        asset_staff_reports:[report],profiles:[{id:"person",full_name:"Synthetic employee"}],units:[{id:"unit",name:"Synthetic department"}]};
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows[table] || [])});
    });
    await page.goto("/tests/fixtures/hr-overview-review.html?audit=screen&screen=assets");
    await expect(page.getByText("Equipment reported by staff")).toBeVisible();
    await expect(page.getByText("Synthetic employee")).toBeVisible();
    await page.getByRole("button",{name:"Review report"}).click();
    const dialog = page.getByRole("dialog",{name:"Verify reported equipment"});
    await dialog.getByLabel("Verified equipment tag").fill("CEAC-CAM-014");
    await dialog.getByLabel("Equipment verification reason").fill("HR checked handover");
    await dialog.getByRole("button",{name:"Confirm and assign equipment"}).click();
    await expect(dialog).toContainText("Synthetic verification denied");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({table:"asset_resolve_staff_report",body:{
      p_report_id:"reported-1",p_action:"register",p_asset_code:"CEAC-CAM-014",p_reason:"HR checked handover"
    }});
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
