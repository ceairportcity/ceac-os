import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const prototype = readFileSync(
  "docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html", "utf8",
);

test("P1 dedicated Compliance and Payroll previews remain separate and interactive", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Synthetic design only; do not call production, external assets, Supabase or Auth.
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.setContent(prototype, { waitUntil: "domcontentloaded" });

  const previewRole = page.getByRole("combobox", { name: "Preview role" });
  const nav = page.locator("#navigation");
  await previewRole.selectOption("admin");
  await expect(nav.getByRole("button", { name: /Payroll|Compliance/ })).toHaveCount(0);

  await previewRole.selectOption("compliance");
  await expect(nav.getByRole("button", { name: "Independent Compliance desk" })).toBeVisible();
  await expect(nav.getByRole("button", { name: /Payroll/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Compliance & evidence" })).toBeVisible();
  await page.getByRole("button", { name: "Inspect policy exception" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Design-only Compliance evidence preview")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await previewRole.selectOption("payroll");
  await expect(nav.getByRole("button", { name: "Payroll preparation and approval" })).toBeVisible();
  await expect(nav.getByRole("button", { name: /Compliance/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Protected payroll operations" })).toBeVisible();
  await page.getByRole("button", { name: "Inspect sample pay run" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Synthetic payroll detail")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await previewRole.selectOption("manager");
  await expect(nav.getByRole("button", { name: /Payroll|Compliance/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("P1 restricted preview surfaces are usable at phone viewport without activating private data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.setContent(prototype, { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Preview role" }).selectOption("compliance");
  await expect(page.getByRole("heading", { name: "Compliance & evidence" })).toBeVisible();
  await page.getByRole("button", { name: "Inspect policy exception" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "P1 phone preview horizontal overflow").toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Preview role" }).selectOption("payroll");
  await expect(page.getByRole("heading", { name: "Protected payroll operations" })).toBeVisible();
});
test("P1 Finance and Quarterly event previews preserve separation and local-only interactions", async ({ page }) => {
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.setContent(prototype, { waitUntil: "domcontentloaded" });
  const rolePicker = page.getByRole("combobox", { name: "Preview role" });
  const navigation = page.locator("#navigation");
  await rolePicker.selectOption("finance");
  await expect(page.getByRole("heading", { name: "Finance controls & source evidence" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /Payroll|Quarterly/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Inspect finance request" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Synthetic finance request inspection only")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const role of ["admin", "executive"]) {
    await rolePicker.selectOption(role);
    await navigation.getByRole("button", { name: "Quarterly event" }).click();
    await expect(page.getByRole("heading", { name: "Quarterly review event" })).toBeVisible();
    await page.getByRole("button", { name: "Review event setup" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Quarterly review event design only")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  }
  await rolePicker.selectOption("volunteer");
  await expect(navigation.getByRole("button", { name: /Quarterly|Finance|Payroll/ })).toHaveCount(0);
});
test("P1 Manager and Executive previews hide metrics on evidence-load failure", async ({ page }) => {
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.setContent(prototype, { waitUntil: "domcontentloaded" });
  const role = page.getByRole("combobox", { name: "Preview role" });
  for (const persona of ["manager","executive"]) {
    await role.selectOption(persona);
    await page.locator("#navigation").getByRole("button", { name: persona === "manager" ? "Manager reporting" : "Quarterly evidence" }).click();
    await expect(page.getByRole("heading", { name: persona === "manager" ? "Manager period report" : "Executive evidence review" })).toBeVisible();
    await expect(page.getByText("Period coverage", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview evidence failure" }).click();
    await expect(page.getByRole("alert")).toHaveText("Report evidence could not be loaded");
    await expect(page.getByText("Period coverage", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Verified work outputs", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore sample evidence" }).click();
    await expect(page.getByText("Period coverage", { exact: true })).toBeVisible();
  }
});
test("P1 Manager unit switching shows selected simulated headship without leaking role privileges", async ({ page }) => {
  await page.route("**/*", r => r.abort("blockedbyclient"));
  await page.setContent(prototype, {waitUntil: "domcontentloaded"});
  const picker=page.getByRole("combobox",{name:"Preview role"});
  await picker.selectOption("manager");
  await expect(page.getByText("Selected unit: Unit One")).toBeVisible();
  await page.getByRole("button",{name:"Switch sample unit"}).click();
  await expect(page.getByText("Selected unit: Unit Two")).toBeVisible();
  await expect(page.locator("#navigation").getByRole("button",{name:/Payroll|Compliance/})).toHaveCount(0);
  await picker.selectOption("volunteer");
  await expect(page.getByText("Selected unit: Unit Two")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Switch sample unit"})).toHaveCount(0);
  await picker.selectOption("manager");
  await expect(page.getByText("Selected unit: Unit One")).toBeVisible();
});
test("P1 period reporting preview distinguishes loading, unfiled evidence, and real load failure",async({page})=>{
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  await page.getByRole("combobox",{name:"Preview role"}).selectOption("manager");
  await page.locator("#navigation").getByRole("button",{name:"Manager reporting"}).click();
  await page.getByRole("button",{name:"Preview loading"}).click();
  await expect(page.locator('[data-evidence-phase="loading"]')).toBeVisible();
  await expect(page.getByText("Period coverage",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Restore sample evidence"}).click();
  await page.getByRole("button",{name:"Preview empty period"}).click();
  await expect(page.locator('[data-evidence-phase="empty"]')).toBeVisible();
  await expect(page.getByText("Verified work outputs",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Restore sample evidence"}).click();
  await page.getByRole("button",{name:"Preview evidence failure"}).click();
  await expect(page.getByRole("alert")).toHaveText("Report evidence could not be loaded");
  await expect(page.getByText("Verified work outputs",{exact:true})).toHaveCount(0);
});
test("P1 local Work and project-link draft remains scope-isolated and never saved",async({page})=>{
  await page.route("**/*",route=>route.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const role=page.getByRole("combobox",{name:"Preview role"});
  await role.selectOption("manager");
  await page.locator("#navigation").getByRole("button",{name:"Work & delegations"}).click();
  await page.getByRole("button",{name:"Give out work"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox",{name:"Work title"}).fill("Sample reviewed unit deliverable");
  await page.getByLabel("Project/objective link").selectOption({label:"Workstream Alpha / Operating readiness"});
  await page.getByRole("button",{name:"Review sample action"}).click();
  await expect(page.getByText("Sample reviewed unit deliverable")).toBeVisible();
  await expect(page.getByRole("button",{name:"Given out",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".s2w-state.draft",{hasText:"Sample draft, not saved"})).toBeVisible();
  await page.locator("#navigation").getByRole("button",{name:"Overview"}).click();
  await page.getByRole("button",{name:"Switch sample unit"}).click();
  await page.locator("#navigation").getByRole("button",{name:"Work & delegations"}).click();
  await expect(page.getByText("Sample reviewed unit deliverable")).toHaveCount(0);
  await role.selectOption("volunteer");
  await page.locator("#navigation").getByRole("button",{name:"Assigned activities"}).click();
  await expect(page.getByText("Sample reviewed unit deliverable")).toHaveCount(0);
});
test("P1 Auth setup, challenge and recovery previews never claim real assurance",async({page})=>{
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const picker=page.getByRole("combobox",{name:"Preview role"});
  await picker.selectOption("staff");
  await page.locator("#navigation").getByRole("button",{name:"Account security"}).click();
  await expect(page.getByRole("heading",{name:"Enrol a supported authenticator"})).toBeVisible();
  await page.getByRole("button",{name:"Preview challenge"}).click();
  await expect(page.getByRole("heading",{name:"Confirm authenticator challenge"})).toBeVisible();
  await expect(page.getByText("Protected action withheld pending real proof.",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Preview recovery"}).click();
  await expect(page.getByRole("heading",{name:"Recover protected access"})).toBeVisible();
  await page.getByRole("button",{name:"Inspect challenge form"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("This is a UI demonstration, not a real authenticator seed or recovery pathway.")).toBeVisible();
  await page.keyboard.press("Escape");
  await picker.selectOption("volunteer");
  await page.locator("#navigation").getByRole("button",{name:"Account security"}).click();
  await expect(page.getByRole("heading",{name:"Enrol a supported authenticator"})).toBeVisible();
});
test("P1 project-close evidence drawer is authoring-only for Manager and never closes a real project",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const role=page.getByRole("combobox",{name:"Preview role"});
  for(const persona of ["staff","admin","executive","volunteer"]){
    await role.selectOption(persona);
    await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
    await expect(page.getByRole("button",{name:"Preview project closure"})).toHaveCount(0);
    await expect(page.getByText("Read-only view")).toBeVisible();
  }
  await role.selectOption("manager");
  await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
  await page.getByRole("button",{name:"Preview project closure"}).click();
  const drawer=page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading",{name:"Project closure evidence review"})).toBeVisible();
  await expect(drawer.getByLabel("Source evidence reference")).toBeVisible();
  await expect(drawer.getByLabel("Contributing unit attribution")).toBeVisible();
  await drawer.getByLabel("Evidence readiness").selectOption({label:"Verified source evidence ready"});
  await drawer.getByLabel("Source evidence reference").fill("Synthetic evidence ref A");
  await drawer.getByLabel("Contributing unit attribution").fill("Unit One and Unit Two synthetic contributions");
  await drawer.getByRole("button",{name:"Review sample action"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#announcement")).toContainText("No real data was saved or submitted.");
  expect(errors).toEqual([]);
});
test("P1 Calendar and Meeting review remain owner-private and scope-specific at phone viewport",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const picker=page.getByRole("combobox",{name:"Preview role"});
  const nav=page.locator("#navigation");
  for(const persona of ["staff","support"]){
    await picker.selectOption(persona);
    await nav.getByRole("button",{name:"My calendar"}).click();
    await expect(page.getByRole("heading",{name:"My calendar"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Review unit meeting setup"})).toHaveCount(0);
    await page.getByRole("button",{name:"Review my private event"}).click();
    await expect(page.getByRole("dialog").getByLabel("Privacy")).toHaveValue("Only me");
    await page.keyboard.press("Escape");
  }
  for(const persona of ["manager","admin","executive"]){
    await picker.selectOption(persona);
    await nav.getByRole("button",{name:"My calendar"}).click();
    await page.getByRole("button",{name:"Review unit meeting setup"}).click();
    await expect(page.getByRole("dialog").getByLabel("Meeting audience")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test("P1 employee only sees HR-issued appraisal after simulated publication and may review own response",async({page})=>{
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const picker=page.getByRole("combobox",{name:"Preview role"});
  await picker.selectOption("staff");
  await page.locator("#navigation").getByRole("button",{name:"My appraisal"}).click();
  await expect(page.getByRole("heading",{name:"Awaiting HR publication"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Review my response"})).toHaveCount(0);
  await page.getByRole("button",{name:"Preview HR-issued review"}).click();
  await expect(page.getByRole("heading",{name:"Published review · demonstration"})).toBeVisible();
  await page.getByRole("button",{name:"Review my response"}).click();
  await expect(page.getByRole("dialog").getByLabel("Evidence or clarification")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Evidence or clarification").fill("Sample employee explanation");
  await page.getByRole("dialog").getByRole("button",{name:"Review sample action"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Sample response recorded locally, not submitted")).toBeVisible();
  await picker.selectOption("volunteer");
  await expect(page.locator("#navigation").getByRole("button",{name:"My appraisal"})).toHaveCount(0);
  await picker.selectOption("manager");
  await page.locator("#navigation").getByRole("button",{name:"My appraisal"}).click();
  await expect(page.getByRole("heading",{name:"Awaiting HR publication"})).toBeVisible();
});
test("P1 Manager Team preview cannot grant invitation access; Administration invite respects employee/volunteer distinction",async({page})=>{
  await page.route("**/*",r=>r.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const picker=page.getByRole("combobox",{name:"Preview role"});
  await picker.selectOption("manager");
  await page.locator("#navigation").getByRole("button",{name:"Team",exact:true}).click();
  await expect(page.getByRole("heading",{name:"My team"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Review member invitation"})).toHaveCount(0);
  await picker.selectOption("admin");
  await page.locator("#navigation").getByRole("button",{name:"People & access"}).click();
  await page.getByRole("button",{name:"Review member invitation"}).click();
  const drawer=page.getByRole("dialog");
  await expect(drawer.getByLabel("Invitation email")).toBeVisible();
  await drawer.getByLabel("Invitee display name").fill("Sample invited member");
  await drawer.getByLabel("Invitation email").fill("test@example.invalid");
  await drawer.getByLabel("Participation type").selectOption({label:"Nonsalaried Volunteer"});
  await drawer.getByRole("button",{name:"Review sample action"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#announcement")).toContainText("No real data was saved or submitted.");
  await picker.selectOption("manager");
  await expect(page.getByRole("button",{name:"Review member invitation"})).toHaveCount(0);
});

test("P1 human rating preview requires Manager authority, rating, reason and evidence",async({page})=>{
  await page.route("**/*",route=>route.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const role=page.getByRole("combobox",{name:"Preview role"});
  const nav=page.locator("#navigation");
  await role.selectOption("admin");
  await nav.getByRole("button",{name:"Quarterly reviews"}).click();
  await expect(page.getByRole("heading",{name:"Quarterly review oversight"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Open rating entry"})).toHaveCount(0);
  await role.selectOption("manager");
  await nav.getByRole("button",{name:"Team appraisals"}).click();
  await expect(page.getByRole("heading",{name:"Team appraisals"})).toBeVisible();
  await page.getByRole("button",{name:"Open rating entry"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button",{name:"Review sample action"}).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel("Human rating").evaluate(el=>el.checkValidity())).toBe(false);
  await dialog.getByLabel("Human rating").selectOption("3");
  await dialog.getByRole("button",{name:"Review sample action"}).click();
  expect(await dialog.getByLabel("Required explanation").evaluate(el=>el.checkValidity())).toBe(false);
  await dialog.getByLabel("Required explanation").fill("Sample observed execution with reviewer context");
  await dialog.getByRole("button",{name:"Review sample action"}).click();
  expect(await dialog.getByLabel("Source evidence reference").evaluate(el=>el.checkValidity())).toBe(false);
  await dialog.getByLabel("Source evidence reference").fill("SYNTHETIC-EVIDENCE-1");
  await dialog.getByRole("button",{name:"Review sample action"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#announcement")).toContainText("No real data was saved or submitted");
  await role.selectOption("volunteer");
  await expect(nav.getByRole("button",{name:/appraisal|Quarterly reviews|Team appraisals/i})).toHaveCount(0);
});

test("P1 scenic Overview matches approved information hierarchy with real role distinctions at desktop and phone",async({page})=>{
  await page.route("**/*",route=>route.abort("blockedbyclient"));
  await page.setContent(prototype,{waitUntil:"domcontentloaded"});
  const role=page.getByRole("combobox",{name:"Preview role"});
  await role.selectOption("manager");
  await expect(page.locator(".s2ov-hero").getByRole("heading",{name:"Overview"})).toBeVisible();
  await expect(page.locator(".s2ov-four > .panel")).toHaveCount(4);
  await expect(page.locator(".s2ov-lower > .panel")).toHaveCount(2);
  await expect(page.getByRole("heading",{name:"My work session"})).toBeVisible();
  await page.getByRole("button",{name:"Start sample session"}).click();
  await expect(page.getByRole("button",{name:"End sample session"})).toBeVisible();
  await expect(page.getByText("Session started — sample")).toBeVisible();
  await role.selectOption("volunteer");
  await expect(page.getByRole("heading",{name:"My work session"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Start sample session"})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"My volunteering"})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await role.selectOption("manager");
  await expect(page.locator(".s2ov-hero")).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,"scenic Overview must not overflow phone width").toBeLessThanOrEqual(1);
});

test("P1 Work owner-selected desktop register and phone inspector retain only local draft data",async({page})=>{
 await page.route("**/*",route=>route.abort("blockedbyclient"));
 await page.setContent(prototype,{waitUntil:"domcontentloaded"});
 const role=page.getByRole("combobox",{name:"Preview role"});
 await role.selectOption("manager");
 await page.locator("#navigation").getByRole("button",{name:"Work & delegations"}).click();
 await expect(page.locator(".s2w-register").getByRole("heading",{name:"Responsibilities"})).toBeVisible();
 await expect(page.locator(".s2w-inspector").getByRole("heading",{name:"Selected responsibility"})).toBeVisible();
 await expect(page.getByText("Waiting & review",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Give out work"})).toBeVisible();
 await page.getByRole("button",{name:"Given out",exact:true}).click();
 await expect(page.getByText("Follow up with unit team")).toBeVisible();
 await page.getByRole("button",{name:"My work",exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator(".s2w-register")).toBeVisible();
 await expect(page.locator(".s2w-inspector")).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow,"owner Work phone register should not overflow horizontally").toBeLessThanOrEqual(1);
 await role.selectOption("staff");
 await page.locator("#navigation").getByRole("button",{name:"My work"}).click();
 await expect(page.getByRole("button",{name:"Give out work"})).toHaveCount(0);
});

test("P1 selected Projects collaborative family is phone safe and supports only Manager closure preview",async({page})=>{
 await page.route("**/*",r=>r.abort("blockedbyclient"));
 await page.setContent(prototype,{waitUntil:"domcontentloaded"});
 const role=page.getByRole("combobox",{name:"Preview role"});
 await role.selectOption("manager");
 await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
 await expect(page.locator(".s2pr-metric")).toHaveCount(4);
 await expect(page.locator(".s2pr-taskrow")).toHaveCount(4);
 await expect(page.getByRole("heading",{name:"Project team and departments"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"About this project"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Preview project closure"})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow,"selected Projects family must not overflow 390px phone").toBeLessThanOrEqual(1);
 await role.selectOption("staff");
 await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
 await expect(page.getByRole("button",{name:"Preview project closure"})).toHaveCount(0);
 await expect(page.getByText("Read-only view")).toBeVisible();
});

test("P1 Projects connected tabs navigate sample views without granting hidden project authority",async({page})=>{
 await page.route("**/*",r=>r.abort("blockedbyclient"));
 await page.setContent(prototype,{waitUntil:"domcontentloaded"});
 const role=page.getByRole("combobox",{name:"Preview role"});
 await role.selectOption("manager");
 await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
 const tabs=page.getByRole("tablist",{name:"Project family sections"});
 await expect(tabs.getByRole("tab",{name:"Overview"})).toHaveAttribute("aria-selected","true");
 await tabs.getByRole("tab",{name:"Files"}).click();
 await expect(page.getByRole("tabpanel",{name:"Files project preview"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Project files"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Recent tasks"})).toHaveCount(0);
 await tabs.getByRole("tab",{name:"Tasks"}).click();
 await expect(page.getByRole("heading",{name:"Recent tasks"})).toBeVisible();
 await tabs.getByRole("tab",{name:"Settings"}).click();
 await expect(page.getByText("Manager authoring preview only.",{exact:false})).toBeVisible();
 await role.selectOption("staff");
 await page.locator("#navigation").getByRole("button",{name:"Projects"}).click();
 await tabs.getByRole("tab",{name:"Settings"}).click();
 await expect(page.getByText("Read-only view. You cannot edit",{exact:false})).toBeVisible();
 await expect(page.getByRole("button",{name:"Preview project closure"})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow,"Projects tabs should remain phone-safe").toBeLessThanOrEqual(1);
});
test("P1 protected HR review rejects missing evidence and keeps employee disclosures separate",async({page})=>{
 await page.route("**/*",route=>route.abort("blockedbyclient"));
 await page.setContent(prototype,{waitUntil:"domcontentloaded"});
 const role=page.getByRole("combobox",{name:"Preview role"});
 await role.selectOption("admin");
 const nav=page.locator("#navigation");
 await nav.getByRole("button",{name:"Protected HR"}).click();
 await expect(page.getByText("Awaiting independent HR verification")).toBeVisible();
 await page.getByRole("button",{name:"Preview missing evidence"}).click();
 await expect(page.getByRole("alert").filter({hasText:"Required rating evidence could not be loaded"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Review HR publication"})).toHaveCount(0);
 await page.getByRole("button",{name:"Return to HR draft"}).click();
 await page.getByRole("button",{name:"Review HR publication"}).click();
 const dialog=page.getByRole("dialog",{name:"Design workflow preview"});
 await expect(dialog.getByLabel("Verified source evidence reference")).toBeVisible();
 expect(await dialog.getByLabel("Verified source evidence reference").evaluate(el=>el.checkValidity())).toBe(false);
 await dialog.getByLabel("Verified source evidence reference").fill("TEST-EVIDENCE-01");
 await dialog.getByLabel("Independent HR release explanation").fill("Independent review of source and version (sample)");
 await dialog.getByLabel("Publication scope").selectOption("own");
 await dialog.getByRole("button",{name:"Review sample action"}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByText("Issued · sample")).toBeVisible();
 await role.selectOption("manager");
 await expect(nav.getByRole("button",{name:"Protected HR"})).toHaveCount(0);
 await role.selectOption("staff");
 await nav.getByRole("button",{name:"My appraisal"}).click();
 await expect(page.getByRole("heading",{name:"Awaiting HR publication"})).toBeVisible();
 await expect(page.getByText("Issued · sample")).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow,"protected HR preview must fit a 390px screen").toBeLessThanOrEqual(1);
});
