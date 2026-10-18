import zlib from "node:zlib";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHomeBaselines } from "./visual-home-baselines.js";
import { ceacLandscapeCatalog } from "../src/lib/ceacLandscapeCatalog.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const roles = [
  ["staff", "staff@ceac.local.test", ".staff-app"],
  ["manager", "manager@ceac.local.test", ".manager-app"],
  ["administration", "admin@ceac.local.test", ".office-app"],
  ["executive", "exec@ceac.local.test", ".executive-app"],
];

const GRID_W = 12;
const GRID_H = 12;

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  expect(buffer.subarray(0, 8).toString("hex")).toBe(signature);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  expect(bitDepth).toBe(8);
  expect(interlace).toBe(0);
  expect([2, 6]).toContain(colorType);

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);

  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++];
    const row = y * stride;
    const previous = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[source++];
      const left = x >= bytesPerPixel ? pixels[row + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[previous + x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[row + x] = (encoded + predictor) & 255;
    }
  }

  return { width, height, bytesPerPixel, pixels };
}

function visualFingerprint(buffer) {
  const image = decodePng(buffer);
  const rgb = [];

  for (let gy = 0; gy < GRID_H; gy += 1) {
    const y0 = Math.floor((gy * image.height) / GRID_H);
    const y1 = Math.floor(((gy + 1) * image.height) / GRID_H);
    for (let gx = 0; gx < GRID_W; gx += 1) {
      const x0 = Math.floor((gx * image.width) / GRID_W);
      const x1 = Math.floor(((gx + 1) * image.width) / GRID_W);
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        let pos = y * image.width * image.bytesPerPixel + x0 * image.bytesPerPixel;
        for (let x = x0; x < x1; x += 1) {
          red += image.pixels[pos];
          green += image.pixels[pos + 1];
          blue += image.pixels[pos + 2];
          count += 1;
          pos += image.bytesPerPixel;
        }
      }
      rgb.push(Math.round(red / count), Math.round(green / count), Math.round(blue / count));
    }
  }

  return { width: image.width, height: image.height, rgb };
}

function meanAbsoluteError(actual, expected) {
  let total = 0;
  for (let i = 0; i < expected.length; i += 1) total += Math.abs(actual[i] - expected[i]);
  return total / expected.length;
}

function roleContentRegion(rgb) {
  const values = [];
  // Stage 4 deliberately replaces the shared shell. Preserve the existing
  // role-page regression signal by comparing only grid cells safely inside
  // the workspace: below both old/new top bars and right of both sidebars.
  for (let gy = 1; gy < GRID_H; gy += 1) {
    for (let gx = 2; gx < GRID_W; gx += 1) {
      const offset = (gy * GRID_W + gx) * 3;
      values.push(rgb[offset], rgb[offset + 1], rgb[offset + 2]);
    }
  }
  return values;
}

test.describe("CEAC visual regression", () => {
  for (const [role, email, appClass] of roles) {
    test(`${role} home stays within the approved visual baseline`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      // Ten approved scenic photographs rotate each Ghana day in the app.
      // Stabilise ONLY the bitmap used by this layout-fingerprint test,
      // without changing the application clock, actual selected image URL
      // or production daily photo rotation. Source unit tests separately
      // require all ten real licensed images and date-correct selection.
      await page.route("**/assets/ceac-landscapes/scene-*.webp", (route) =>
        route.fulfill({ path: "public/assets/ceac-landscapes/scene-01.webp" }));
      await page.goto("/");
      await page.getByPlaceholder("Work email").fill(email);
      await page.getByPlaceholder("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.locator(appClass)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(".body").first()).toBeVisible({ timeout: 15000 });
      if (role === "manager") {
        await expect(page.locator(".managerv2-main")).toBeVisible({ timeout: 15000 });
      } else if (role === "administration") {
        await expect(page.locator(".adminv2-main")).toBeVisible({ timeout: 15000 });
      }
      await page.evaluate(() => document.fonts.ready);
      const scenic = page.locator(".s2-scenic-photo img");
      if (await scenic.count()) {
        const actualSrc = await scenic.first().getAttribute("src");
        expect(ceacLandscapeCatalog.some((photo) => photo.src === actualSrc)).toBe(true);
        await expect.poll(() => scenic.first().evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      }
      await page.waitForTimeout(250);

      // Preserve the actual synthetic-role rendering for comparison against
      // owner-approved V2 designs. Do not silently rebaseline or relax the
      // existing Admin/Executive colour/layout regression threshold.
      mkdirSync("test-artifacts", { recursive: true });
      const screenshot = await page.screenshot({
        path: `test-artifacts/visual-home-${role}-desktop-1440.png`,
      });
      if (role === "manager") {
        await expect(page.locator(".fpg9-home-hero")).toBeVisible();
        await expect(page.locator(".fpg9-home-reference")).toBeVisible();
        await expect(page.locator(".fpg9-calendar-card")).toBeVisible();
        await expect(page.locator(".fpg9-module-strip")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      } else {
        const actual = visualFingerprint(screenshot);
        const expected = visualHomeBaselines[role];
        // Fail closed on missing/truncated approved reference data. The owner
        // approved R3/R4 fingerprints for Admin/Executive, not an empty array
        // or a relaxed visual threshold.
        expect(expected.rgb, `${role} approved 12×12 reference must be complete`)
          .toHaveLength(GRID_W * GRID_H * 3);
        expect(actual.rgb).toHaveLength(GRID_W * GRID_H * 3);
        expect(actual.width).toBe(expected.width);
        expect(actual.height).toBe(expected.height);
        const actualContent = roleContentRegion(actual.rgb);
        const expectedContent = roleContentRegion(expected.rgb);
        const error = meanAbsoluteError(actualContent, expectedContent);
        // Diagnostic evidence, not a rebaseline or a relaxed visual guard.
        // On failure preserve the exact changed coarse-grid cells so an
        // engineer can compare the approved mockup and the rendered screenshot.
        if (error > 6) {
          const changes = [];
          for (let i = 0; i < actualContent.length; i += 3) {
            const actualRgb = actualContent.slice(i, i + 3);
            const expectedRgb = expectedContent.slice(i, i + 3);
            const delta = actualRgb.map((value, c) => Math.abs(value - expectedRgb[c]));
            changes.push({
              gridX: 2 + ((i / 3) % (GRID_W - 2)),
              gridY: 1 + Math.floor((i / 3) / (GRID_W - 2)),
              expectedRgb, actualRgb,
              meanError: Math.round((delta[0] + delta[1] + delta[2]) / 3 * 100) / 100,
            });
          }
          changes.sort((a, b) => b.meanError - a.meanError);
          const evidence = JSON.stringify({
            role, baselineThreshold: 6, overallMeanError: error,
            screenshot: `test-artifacts/visual-home-${role}-desktop-1440.png`,
            differences: changes.slice(0, 20),
          }, null, 2);
          console.error(`CEAC visual baseline evidence: ${evidence}`);
          await test.info().attach(`visual-difference-${role}.json`, {
            body: Buffer.from(evidence), contentType: "application/json",
          });
        }
        expect(error, `${role} role-content fingerprint drifted (mean RGB error ${error.toFixed(2)})`).toBeLessThanOrEqual(6);
      }

      await context.close();
    });
  }
});
