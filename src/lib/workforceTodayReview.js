// Evidence categories are operational REVIEW FILTERS, never attendance findings.
// An unavailable source must never be counted as an absent session.
export function workforceTodayReviewCategory({configured=false,expected=null,started=false,
 approvedLeave=false,sessionEvidenceUnavailable=false,recordedScheduleUnavailable=false,
 loginAvailable=true,identityUnlinked=false,active=true}={}) {
 if(identityUnlinked)return "identity_unlinked";
 if(!active)return "inactive";
 if(approvedLeave) return "approved_leave";
 if(sessionEvidenceUnavailable)return "evidence_unavailable";
 if(recordedScheduleUnavailable)return "schedule_source_unavailable";
 if(!configured || expected===null)return "schedule_unconfigured";
 if(!loginAvailable)return "no_login_account";
 if(started)return "recorded_start";
 if(expected===true)return "no_session_recorded";
 return "no_session_expected";
}
export const workforceTodayReviewNeedsReview = category =>
 ["identity_unlinked","evidence_unavailable","schedule_source_unavailable",
  "schedule_unconfigured","no_session_recorded"].includes(category);
