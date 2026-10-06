// Use documented Auth codes, never raw server messages or credential values.
export function signInErrorMessage(error) {
  if (error?.code === "invalid_credentials") return "That email and password did not match. Please try again.";
  if (error?.code === "email_not_confirmed") return "Your email still needs verification. Open the newest CEAC activation email or contact Administration.";
  if (error?.code === "user_banned") return "This account cannot sign in. Contact CEAC Administration.";
  if (error?.status === 429 || error?.code === "over_request_rate_limit") return "Too many sign-in attempts. Wait a few minutes before trying again.";
  if (error?.code === "email_provider_disabled") return "Email sign-in is unavailable. Contact CEAC Administration.";
  if (error?.status >= 500) return "The sign-in service is temporarily unavailable. Please try again later.";
  if (error?.name === "AuthRetryableFetchError" || error?.name === "TypeError" || error?.code === "request_timeout") return "CEAC could not reach the sign-in service. Check your connection and try again.";
  return "CEAC could not complete sign-in. Please try again, or contact Administration if this continues.";
}
