// Invitations must never inherit a protected preview's origin.
export function authRedirect(path, configuredUrl = import.meta.env?.VITE_CEAC_APP_URL) {
  const app = new URL(configuredUrl || "https://ceac-os-git.vercel.app");
  if (app.protocol !== "https:" || app.username || app.password || app.search || app.hash
      || app.pathname !== "/") {
    throw new Error("CEAC account access needs a valid application address. Contact Administration.");
  }
  return new URL(path, app.origin).href;
}
