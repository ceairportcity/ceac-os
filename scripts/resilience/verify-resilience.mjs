import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.display !== "standalone" || manifest.scope !== "/" || !manifest.icons?.some((icon) => icon.sizes === "512x512")) throw new Error("Manifest installability contract failed.");
const sw = read("public/sw.js");
for (const marker of ["supabase", "request.method !== \"GET\"", "SKIP_WAITING", "offline.html"]) if (!sw.includes(marker)) throw new Error(`Service-worker contract missing: ${marker}`);
if (/cache\.put\([^\n]*(supabase|\/rest\/|\/auth\/)/i.test(sw)) throw new Error("Service worker appears to cache protected API data.");
const registration = read("src/resilience/registerServiceWorker.js");
if (!registration.includes("navigator.serviceWorker.register")) throw new Error("Service-worker registration is missing.");
console.log("CEAC resilience source contracts passed.");
