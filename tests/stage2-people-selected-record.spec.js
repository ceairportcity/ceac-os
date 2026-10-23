import {test,expect} from "@playwright/test";

/** This is an authenticated HR workflow, not toolbar-presence certification. */
test("HR can open a roster-only employee's edit directly from selected profile and cancel safely",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:800}});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 const employee=page.locator(".fpg-people-roster-row").filter({hasText:"Roster-only HR Fixture"}).first();
 await expect(employee).toBeVisible({timeout:15000});
 await employee.click();
 const actions=page.getByRole("group",{name:"Employee record actions"});
 await expect(actions).toBeVisible();
 const chooser=page.getByText("Switch employee · search directory");
 await expect(chooser).toBeVisible();
 await expect(page.locator(".ev2p-admin-master-list")).not.toHaveAttribute("open","");
 await actions.getByRole("button",{name:"Edit employee record"}).click();
 await expect(page.getByRole("tab",{name:"Employment",exact:true})).toHaveAttribute("aria-selected","true");
 const editor=page.getByRole("region",{name:"Roster-only HR record and placement"});
 await expect(editor.getByLabel("Full name")).toBeVisible({timeout:15000});
 await expect(editor.getByLabel("HR contact email (not login)")).toBeVisible();
 await expect(editor.getByLabel("Primary department")).toBeVisible();
 const original=await editor.getByLabel("Full name").inputValue();
 await editor.getByLabel("Full name").fill("Unsaved title must not persist");
 await editor.getByRole("button",{name:"Cancel"}).click();
 await expect(editor.getByLabel("Full name")).toHaveCount(0);
 await actions.getByRole("button",{name:"Edit employee record"}).click();
 await expect(editor.getByLabel("Full name")).toHaveValue(original);
 await editor.getByRole("button",{name:"Cancel"}).click();
 await actions.getByRole("button",{name:"Work schedule"}).click();
 await expect(page.getByRole("tab",{name:"Time & Leave"})).toHaveAttribute("aria-selected","true");
 await expect(page.getByText("HR-authorised working schedule")).toBeVisible();
 await context.close();
});

test("390px People record keeps complete HR action access without the long directory rail",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 const employee=page.locator(".fpg-people-roster-row").filter({hasText:"Roster-only HR Fixture"}).first();
 await employee.click();
 const actions=page.getByRole("group",{name:"Employee record actions"});
 await expect(actions.getByRole("button",{name:"Edit employee record"})).toBeVisible();
 await expect(actions.getByRole("button",{name:"Assign / transfer department"})).toBeVisible();
 await expect(actions.getByRole("button",{name:"Invite account"})).toBeVisible();
 await expect(page.locator(".ev2p-admin-master-list")).not.toHaveAttribute("open","");
 await context.close();
});
