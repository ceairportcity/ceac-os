import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

test("ten genuine downloaded photographs have complete provenance and exact hashes", () => {
  const manifest = JSON.parse(readFileSync("public/assets/ceac-landscapes/manifest.json", "utf8"));
  assert.equal(manifest.images.length, 10);
  const hashes = new Set();
  const srcs = new Set();
  for (const image of manifest.images) {
    assert.match(image.src, /^\/assets\/ceac-landscapes\/scene-\d\d\.webp$/);
    assert.ok(image.sourceUrl.startsWith("https://unsplash.com/photos/"));
    assert.equal(image.licenseUrl, "https://unsplash.com/license");
    assert.ok(image.photographer?.trim());
    assert.ok(image.alt?.trim());
    const bytes = readFileSync(join("public", image.src));
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha, image.sha256);
    assert.equal(bytes.length, image.bytes);
    hashes.add(sha);
    srcs.add(image.src);
  }
  assert.equal(hashes.size, 10);
  assert.equal(srcs.size, 10);
});
