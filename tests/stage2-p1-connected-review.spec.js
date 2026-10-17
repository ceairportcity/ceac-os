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
