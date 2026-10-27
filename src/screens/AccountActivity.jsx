import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { SegmentedControl } from "../experience-v2/components";
import AccountMfaSetup from "../components/AccountMfaSetup";
import {
  PersonalBoundary,
  PersonalEmpty,
  PersonalPageHeader,
  PersonalRecordRow,
  PersonalSection,
} from "../experience-v2/personal-family/PersonalFamilyV2";

// Your own account, and nobody else's. Both database functions filter on
// the signed-in person and take no parameter naming anyone, so this cannot
// become a way of watching colleagues.
//
// This exists because prevention eventually fails. A stolen password is
// only as damaging as the time it goes unnoticed, and until now nobody at
// CEAC could see where their account was signed in.
function friendlyDevice(ua) {
  if (!ua || ua === "Unknown device") return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iPhone or iPad"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux" : "";
  return os ? browser + " on " + os : browser;
}

const when = (t) => new Date(t).toLocaleString("en-GB",
  { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AccountActivity({ me }) {
  return <AccountWorkspace key={`${me.org_id}:${me.id}`} me={me}/>;
}

function AccountWorkspace({ me }) {
  const [section,setSection]=useState("security");
  const readGeneration=useRef(0);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => { void load(); return ()=>{readGeneration.current+=1;}; }, []);

  async function load() {
    const generation=++readGeneration.current;
    setLoading(true);
    setSessionError(null);
    setActivityError(null);
    const [s, a] = await Promise.all([
      supabase.rpc("my_sessions"),
      supabase.rpc("my_account_activity", { p_limit: 50 }),
    ]);
    if(generation!==readGeneration.current)return;
    setSessionError(s.error ? humanError(s.error, "Signed-in device records could not be loaded.") : null);
    setActivityError(a.error ? humanError(a.error, "Recent account activity could not be loaded.") : null);
    setSessions(s.error ? [] : (s.data || []));
    setEvents(a.error ? [] : (a.data || []));
    setLoading(false);
  }

  async function signOutHere() {
    setBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setActionError(humanError(error, "This device could not be signed out."));
    } finally {
      setBusy(false);
    }
  }

  // Revokes refresh sessions everywhere, including this one. Already-issued
  // short-lived access tokens on another device can remain valid until expiry.
  async function signOutEverywhere() {
    if (!confirm("Sign out on every device, including this one? You will need to sign in again.")) return;
    setBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) setActionError(humanError(error, "Your other sessions could not be signed out."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="body ev2-personal-page ev2-personal-account"><div className="spin">Loading your account...</div></div>;
  }

  return (
    <div className="body ev2-personal-page ev2-personal-account">
      <PersonalPageHeader
        eyebrow="Account security"
        title="Your account"
        description="Where you are signed in, and what has happened under your name. Only you can see this."
        statusLabel="Your account only"
      />

      <SegmentedControl ariaLabel="Account sections" value={section} onChange={setSection} items={[{value:"security",label:"Security"},{value:"sessions",label:"Sessions"},{value:"activity",label:"Account activity"}]}/>

      {actionError && <div className="flag flag-brick ev2pf-partial-error"><h4>Account action was not completed</h4>{actionError}</div>}

      <div hidden={section!=="security"}>
      <div className="form-grid two">
        <PersonalSection title="Signed-in sessions"><p>{sessionError?"Device records unavailable":`${sessions.length} recorded sessions`}</p><button className="btn btn-ghost btn-sm" onClick={()=>setSection("sessions")}>Review devices</button></PersonalSection>
        <PersonalSection title="Latest account activity"><p>{activityError?"Account activity unavailable":events[0]?String(events[0].action).replace(/[._]/g," "):"No activity recorded"}</p><button className="btn btn-ghost btn-sm" onClick={()=>setSection("activity")}>View full history</button></PersonalSection>
      </div>
      <PersonalSection
        eyebrow="Account protection"
        title="Authenticator app"
        description="Your own authenticator settings. Mandatory two-step sign-in is deferred for this release."
      >
        <AccountMfaSetup key={`${me.org_id}:${me.id}`}/>
      </PersonalSection>

      </div>
      <div hidden={section!=="sessions"}>
      <PersonalSection
        eyebrow="Sessions"
        title="Signed in devices"
        description={sessionError ? "Signed-in device records are temporarily unavailable." : sessions.length === 1 ? "1 session is recorded for your account." : `${sessions.length} sessions are recorded for your account.`}
      >
        {sessionError && <div className="flag flag-brick ev2pf-partial-error"><h4>Signed-in devices could not load</h4>{sessionError}</div>}
        {!sessionError && sessions.length === 0 && <PersonalEmpty title="No signed-in device is recorded" description="No active session record is available for your account." />}
        {sessions.map((s) => (
          <PersonalRecordRow
            key={s.session_id}
            title={friendlyDevice(s.device)}
            meta={`Last used ${when(s.last_seen)}`}
            detail={`Signed in ${when(s.signed_in_at)} · from ${s.ip}`}
            action={s.is_current ? <span className="pill p-green">This device</span> : null}
          />
        ))}

        {sessions.length > 1 && (
          <div className="flag flag-amber ev2pf-account-warning">
            <h4>More than one device is signed in</h4>
            That is normal if you use a phone and a computer. If you do not recognise one of them, sign out everywhere below and change your password.
          </div>
        )}

        <div className="ev2pf-inline-actions ev2pf-account-actions">
          <button type="button" className="btn wide-auto" onClick={signOutHere} disabled={busy}>
            {busy ? "Signing out..." : "Sign out on this device"}
          </button>
          <button type="button" className="btn btn-ghost wide-auto" onClick={signOutEverywhere} disabled={busy}>
            Sign out on every device
          </button>
        </div>
        <p className="screen-note">
          Signing out everywhere stops those sessions from renewing. A device that already has a short-lived access token may take a short time to lose access.
        </p>
      </PersonalSection>

      </div>
      <div hidden={section!=="activity"}>
      <PersonalSection
        eyebrow="Audit trail"
        title="Recent activity"
        description={activityError ? "Recent attributable activity is temporarily unavailable. This is not a colleague-monitoring surface." : "Consequential activity recorded under your account. This is not a colleague-monitoring surface."}
      >
        {activityError && <div className="flag flag-brick ev2pf-partial-error"><h4>Recent account activity could not load</h4>{activityError}</div>}
        {!activityError && events.length === 0 && <PersonalEmpty title="Nothing recorded yet" description="Recent attributable account activity will appear here when available." />}
        {events.map((e, i) => (
          <PersonalRecordRow
            key={i}
            title={String(e.action).replace(/[._]/g, " ")}
            meta={`${when(e.at)} · ${e.by_me ? "by you" : "by " + e.actor_name}`}
            detail={e.resource_type ? String(e.resource_type).replace(/_/g, " ") : null}
          />
        ))}
      </PersonalSection>

      </div>
      <div hidden={section!=="security"}>
      <PersonalSection eyebrow="Security" title="Staying safe">
        <PersonalBoundary title="CEAC will not ask for your password">
          Nobody from CEAC will email or message you asking you to sign in, confirm your password, or open a link to “verify your account”. If you receive one, tell Administration rather than replying to it.
        </PersonalBoundary>
      </PersonalSection>
      </div>
    </div>
  );
}
