import {test,expect} from "@playwright/test";

/**
 * True HR workflow, not an assertion that a button exists.
 * The local role-fixture seed creates a synthetic roster-only employee with no login.
 */
test("HR edits and reopens an unlinked employee's employment and department assignment",async({browser})=>{
 const context=await browser.newContext({viewport:{width:1366,height:768}});
 const page=await context.newPage();
 await page.goto("/");
 const origin=new URL(page.url());
 expect(["localhost","127.0.0.1"]).toContain(origin.hostname);
 await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 await expect(page.locator(".ev2-people-page.ev2-people-admin")).toBeVisible({timeout:15000});
 const person=page.locator(".fpg-people-roster-row").filter({hasText:"Roster-only HR Fixture"}).first();
 await expect(person).toBeVisible();
 await person.click();
 await expect(page.locator(".ev2-admin-person-workspace")).toBeVisible({timeout:15000});
 await page.getByRole("tab",{name:"Employment",exact:true}).click();
 const editor=page.getByRole("region",{name:"Roster-only HR record and placement"});
 await expect(editor.getByText(/Edit this employee without creating an account/)).toBeVisible();
 await editor.getByRole("button",{name:"Edit employee record"}).click();
 await editor.getByLabel("Job title",{exact:true}).fill("Updated HR job title");
 await editor.getByLabel("Primary department").selectOption("20000000-0000-4000-8000-000000000012");
 await editor.getByLabel("Reporting manager").selectOption("31000000-0000-4000-8000-000000000007");
 await editor.getByLabel("Reason for this HR change").fill("Verified reporting line and departmental assignment");
 await editor.getByRole("button",{name:"Save HR record"}).click();
 await expect(editor.getByText("Employment and unit placement saved. HR history was retained.")).toBeVisible();
 await expect(editor.getByText("Updated HR job title")).toBeVisible();
 await expect(editor.getByText(/Manager B Fixture/)).toBeVisible();
 await expect(editor.locator("details").filter({hasText:/HR changes/})).toBeVisible();
 // Reopen the editor. It must display the server-confirmed fields, not invented defaults.
 await editor.getByRole("button",{name:"Edit employee record"}).click();
 await expect(editor.getByLabel("Job title",{exact:true})).toHaveValue("Updated HR job title");
 await expect(editor.getByLabel("Primary department")).toHaveValue("20000000-0000-4000-8000-000000000012");
 await expect(editor.getByLabel("Reporting manager")).toHaveValue("31000000-0000-4000-8000-000000000007");
 await editor.getByRole("button",{name:"Cancel"}).click();
 await expect(editor.getByRole("button",{name:"Edit employee record"})).toBeVisible();
 await context.close();
});

test("ordinary Staff cannot open HR roster editing by direct URL",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".staff-app")).toBeVisible({timeout:15000});
 await page.goto("/?tab=people");
 await expect(page.getByRole("region",{name:"Roster-only HR record and placement"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Save HR record"})).toHaveCount(0);
 await context.close();
});
