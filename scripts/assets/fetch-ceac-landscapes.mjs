// Owner-approved Stage 2 free STOCK photo ingestion.
// Real Unsplash photo pages and licences are pinned in the adjacent curated JSON.
// No runtime third-party APIs. Do not use AI-generated imagery or invented credits.
import { readFile, mkdir, mkdtemp, writeFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const root = resolve(process.cwd());
const catalogue = JSON.parse(await readFile(join(root, "scripts/assets/ceac-landscapes-curated.json"), "utf8"));
if (!Array.isArray(catalogue.images) || catalogue.images.length !== 10) throw Error("Exactly ten photo sources required");
const dir = join(root, "public/assets/ceac-landscapes");
const staging = await mkdtemp(join(tmpdir(), "ceac-landscapes-"));
const entries = [];
try {
  // Sequential remote requests to respect the photo service and bound traffic.
  for (const item of catalogue.images) {
    if (!/^photo-[a-zA-Z0-9-]+$/.test(item.photoId) ||
        !item.sourceUrl.startsWith("https://unsplash.com/photos/") ||
        item.licenseUrl !== "https://unsplash.com/license" ||
        !item.photographer) throw Error("Unverified photo provenance: " + item.id);

    const url = "https://images.unsplash.com/" + item.photoId +
      "?fit=crop&crop=entropy&w=1600&h=620&q=79&fm=webp";
    const response = await fetch(url, { headers: { Accept: "image/webp" }, signal: AbortSignal.timeout(25000) });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("image/")) {
      throw Error("Photo " + item.id + " download returned HTTP " + response.status);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 10000 || bytes.length > 2000000 ||
        bytes.subarray(0, 4).toString() !== "RIFF" ||
        bytes.subarray(8, 12).toString() !== "WEBP") {
      throw Error("Unexpected photo format or size at " + item.id);
    }
    const filename = "scene-" + item.id + ".webp";
    await writeFile(join(staging, filename), bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    entries.push({
      src: "/assets/ceac-landscapes/" + filename,
      alt: item.alt,
      photographer: item.photographer,
      sourceUrl: item.sourceUrl,
      licenseUrl: item.licenseUrl,
      verifiedOn: catalogue.checkedOn,
      sha256,
      bytes: bytes.length,
    });
  }
  if (entries.length !== 10 || new Set(entries.map((v) => v.sha256)).size !== 10) {
    throw Error("Photo set is incomplete or contains repeated images");
  }
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < entries.length; i++) {
    const name = "scene-" + catalogue.images[i].id + ".webp";
    await rename(join(staging, name), join(dir, name));
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    source: "Unsplash free stock photography",
    licence: "https://unsplash.com/license",
    checkedOn: catalogue.checkedOn,
    images: entries,
  }, null, 2) + "\n");
  console.log("Downloaded ten genuine WebP landscape photos and recorded integrity checksums.");
} finally {
  await rm(staging, { recursive: true, force: true });
}
