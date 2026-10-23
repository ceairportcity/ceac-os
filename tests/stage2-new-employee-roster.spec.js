import {test,expect} from "@playwright/test";

/** Local isolated role fixtures only. Never point this spec at a live app. */
test("HR creates a roster-only employee, reads it back, and reopens the saved record",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:800}});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 await expect(page.locator(".ev2-people-page.ev2-people-admin")).toBeVisible({timeout:15000});
 const suffix=String(Date.now());
 const name="Verified new roster person "+suffix;
 const email="manual."+suffix+"@example.test";
 await page.getByRole("button",{name:"Add employee",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Add employee"})).toBeVisible();
 await page.getByLabel("Employee full name").fill(name);
 await page.getByLabel("Employee job title").fill("Operations assistant");
 await page.getByLabel("New employee employment type").selectOption("permanent");
 await page.getByLabel("New employee primary unit").selectOption("20000000-0000-4000-8000-000000000011");
 await page.getByLabel("New employee start date").fill("2026-10-22");
 await page.getByLabel("New employee HR email").fill(email);
 await page.getByLabel("Employee creation reason").fill("Official appointment verified against HR source document");
 await page.getByRole("button",{name:"Save employee"}).click();
 // Parent only opens the employee workspace after the protected RPC and a
 // separate source readback confirm the exact saved roster ID, no login link.
 await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible({timeout:15000});
 await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
 await page.getByRole("button",{name:/All people/i}).click();
 const row=page.locator(".fpg-people-roster-row").filter({hasText:name}).first();
 await expect(row).toBeVisible();
 await expect(row).toContainText("Roster only");
 await row.click();
 await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible({timeout:15000});
 await expect(page.getByRole("group",{name:"Employee record actions"}).getByRole("button",{name:"Invite account"})).toBeVisible();
 // A roster-only record has no account by default. No operational role was
 // created as a side effect of this HR save.
 await context.close();
});

test("Staff cannot use HR Add employee even by direct People navigation",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".staff-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 await expect(page.getByRole("button",{name:"Add employee"})).toHaveCount(0);
 await expect(page.getByLabel("Add employee record")).toHaveCount(0);
 await context.close();
});
