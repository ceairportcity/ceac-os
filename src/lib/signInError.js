// Use documented Auth codes, never raw server messages or credential values.
export function authErrorMessage(error, context = "signin") {
  const code = error?.code;
  const rateLimited = error?.status === 429
    || code === "over_request_rate_limit"
    || code === "over_email_send_rate_limit"
    || code === "email_rate_limit_exceeded";
  const network = error?.name === "AuthRetryableFetchError"
    || error?.name === "TypeError"
    || code === "request_timeout";

  if (context === "signin") {
    if (code === "invalid_credentials") return "That email and password did not match. Please try again.";
    if (code === "email_not_confirmed") return "Your email still needs verification. Open the newest CEAC activation email or contact Administration.";
    if (code === "user_banned") return "This account cannot sign in. Contact CEAC Administration.";
    if (code === "email_provider_disabled") return "Email sign-in is unavailable. Contact CEAC Administration.";
  }
  if (context === "password" && code === "weak_password") return "Choose a stronger password and try again.";
  if (context === "password" && code === "same_password") return "Choose a new password that is different from your current password.";
  if (rateLimited) return "Too many attempts. Wait a minute before trying again.";
  if (error?.status >= 500) return "The secure account service is temporarily unavailable. Please try again later.";
  if (network) return "CEAC could not reach the secure account service. Check your connection and try again.";
  if (context === "link") return "This secure link could not be verified. Open the newest CEAC email link or request another one.";
  if (context === "password") return "Your password could not be saved. Please try again, or request a new recovery link if this continues.";
  if (context === "recovery") return "The recovery email could not be sent. Please try again, or contact Administration if this continues.";
  return "CEAC could not complete sign-in. Please try again, or contact Administration if this continues.";
}
