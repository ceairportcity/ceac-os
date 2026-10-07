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


function isRateLimited(error) {
  return error?.status === 429
    || ["over_request_rate_limit", "over_email_send_rate_limit", "email_rate_limit_exceeded"].includes(error?.code);
}

function isNetworkError(error) {
  return error?.name === "AuthRetryableFetchError"
    || error?.name === "TypeError"
    || error?.code === "request_timeout";
}

export function recoveryErrorMessage(error) {
  if (isRateLimited(error)) return "Too many recovery requests. Wait a minute before trying again.";
  if (error?.status >= 500) return "The recovery service is temporarily unavailable. Please try again later.";
  if (isNetworkError(error)) return "CEAC could not reach the recovery service. Check your connection and try again.";
  return "The recovery email could not be sent. Please try again, or contact Administration if this continues.";
}

export function secureLinkErrorMessage(error) {
  if (isRateLimited(error)) return "Too many verification attempts. Wait a minute before trying the newest CEAC link again.";
  if (error?.status >= 500) return "The secure-link service is temporarily unavailable. Please try again later.";
  if (isNetworkError(error)) return "CEAC could not verify this secure link because the service could not be reached.";
  return "This secure link could not be verified. Open the newest CEAC email link or request another one.";
}

export function passwordUpdateErrorMessage(error) {
  if (error?.code === "weak_password") return "Choose a stronger password and try again.";
  if (error?.code === "same_password") return "Choose a new password that is different from your current password.";
  if (isRateLimited(error)) return "Too many password-change attempts. Wait a minute before trying again.";
  if (error?.status >= 500) return "The password service is temporarily unavailable. Please try again later.";
  if (isNetworkError(error)) return "CEAC could not reach the password service. Check your connection and try again.";
  return "Your password could not be saved. Please try again, or request a new recovery link if this continues.";
}
