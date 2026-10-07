// Use documented Auth codes, never raw provider messages.
export function authErrorMessage(error, context = "signin") {
  const code = error?.code;
  const rateLimited = error?.status === 429 || code?.includes("rate_limit");
  const network = ["AuthRetryableFetchError", "TypeError"].includes(error?.name) || code === "request_timeout";

  if (context === "signin") {
    const known = {
      invalid_credentials: "Email and password did not match. Try again.",
      email_not_confirmed: "Email verification is required. Open the newest CEAC activation email.",
      user_banned: "This account cannot sign in. Contact Administration.",
      email_provider_disabled: "Email sign-in is unavailable. Contact Administration.",
    };
    if (known[code]) return known[code];
  }
  if (context === "password" && code === "weak_password") return "Choose a stronger password.";
  if (context === "password" && code === "same_password") return "Choose a different password.";
  if (rateLimited) return "Too many attempts. Wait a minute.";
  if (error?.status >= 500) return "The secure account service is temporarily unavailable.";
  if (network) return "Check your connection and try again.";
  if (context === "link") return "This secure link could not be verified. Open the newest CEAC email.";
  if (context === "password") return "Your password could not be saved. Try again.";
  if (context === "recovery") return "The recovery email could not be sent. Try again.";
  return "CEAC could not complete sign-in. Try again.";
}
