import { createClient } from "npm:@supabase/supabase-js@2.79.0";
import webpush from "npm:web-push@3.6.7";
import { validateSubscription, buildPushPreview, deliveryOutcome } from "./delivery.mjs";

// This endpoint has no trusted caller by default. Every user operation validates
// a live Supabase JWT; only the Vault-backed worker token may drain the queue.
const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-ceac-push-worker",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });
const cleanId = (value: unknown) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const delayMs = (a: string | null) => a ? Date.parse(a) : NaN;
const activeWorkStatus = new Set(["not_started", "in_progress", "assigned"]);
const getServiceKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; }
  catch { return ""; }
};
const fingerprint = async (endpoint: string) => {
  const bytes = new TextEncoder().encode(endpoint);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(n => n.toString(16).padStart(2,"0")).join("");
};
const secrets = async (admin: any) => {
  const { data, error } = await admin.rpc("ceac_push_server_config");
  if (error) throw new Error("Push credentials not available");
  return data || {};
};
const member = async (admin: any, id: string) => {
  const { data } = await admin.from("profiles")
    .select("id,org_id,active,full_name").eq("id",id).maybeSingle();
  return data?.active ? data : null;
};
const safeNotice = (msg: string, identifier: string, options: Record<string, unknown> = {}) =>
  buildPushPreview({
    id: identifier, sensitivity: options.ordinary ? "ordinary" : "private",
    senderName: options.actor || "CEAC", senderDepartment: options.department || "",
    message: msg,
  }, { showPreview: options.showPreview === true });

async function describeJob(admin: any, job: any, sub: any) {
  const user = await member(admin,job.profile_id);
  if (!user || user.org_id !== job.org_id || sub.profile_id !== job.profile_id ||
      sub.org_id !== job.org_id || sub.revoked_at) return null;
  const preview = sub.preview_allowed === true;
  if (job.source_kind === "notice") {
    const { data: notice } = await admin.from("ceac_notification_events")
      .select("id,org_id,recipient_id,context_kind,context_id,event_kind,read_at")
      .eq("id",job.source_id).eq("recipient_id",job.profile_id).eq("org_id",job.org_id).maybeSingle();
    if (!notice || notice.read_at) return null;
    if (notice.context_kind === "memo") {
      const { data: memo } = await admin.from("memos")
        .select("id,org_id,sender_id,status").eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle();
      if (!memo || memo.status === "draft") return null;
      const { data: recipient } = await admin.from("memo_recipients")
        .select("profile_id").eq("memo_id",memo.id).eq("profile_id",job.profile_id).maybeSingle();
      if (!recipient && memo.sender_id !== job.profile_id) return null;
      const sender = await member(admin,memo.sender_id);
      if (preview && sender) {
        const { data: memberships } = await admin.from("unit_memberships")
          .select("units(name)").eq("profile_id",sender.id).limit(1);
        const department = memberships?.[0]?.units?.name || "";
        return safeNotice("New Memo for you. Open CEAC to read it.",job.id,{
          ordinary:true,actor:sender.full_name,department,showPreview:true,
        });
      }
      return safeNotice("",job.id);
    }
    if (notice.context_kind === "work_item") {
      const { data: work } = await admin.from("work_items")
        .select("id,org_id,assignee_id,assigned_by,status,confidential,title")
        .eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle();
      if (!work || (work.assignee_id !== job.profile_id && work.assigned_by !== job.profile_id)) return null;
      if (notice.event_kind === "work_assigned" && !activeWorkStatus.has(work.status)) return null;
      return safeNotice(work.confidential ? "" : "New work update for you. Open CEAC to review.",job.id,{
        ordinary:!work.confidential,actor:"CEAC Work",showPreview:preview,
      });
    }
    // Other authoritative personal notices contain no private source data.
    return safeNotice("",job.id);
  }
  if (job.source_kind === "work_due" || job.source_kind === "work_overdue") {
    const { data: work } = await admin.from("work_items")
      .select("id,org_id,assignee_id,kind,status,confidential,title,due_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("assignee_id",job.profile_id).maybeSingle();
    if (!work || work.kind === "routine" || !activeWorkStatus.has(work.status) ||
        delayMs(work.due_at) !== delayMs(job.source_due_at)) return null;
    const message = job.source_kind === "work_overdue"
      ? "Your assigned work is past due. Open CEAC to update it."
      : "Your assigned work is due soon.";
    return safeNotice(message,job.id,{
      ordinary:!work.confidential,actor:"CEAC Work",showPreview:preview,
    });
  }
  if (job.source_kind === "meeting_reminder") {
    const { data: meeting } = await admin.from("meeting_sessions")
      .select("id,org_id,status,starts_at,title")
      .eq("id",job.source_id).eq("org_id",job.org_id).maybeSingle();
    if (!meeting || /cancel/i.test(meeting.status || "") ||
        delayMs(meeting.starts_at) !== delayMs(job.source_due_at)) return null;
    const { data: participant } = await admin.from("meeting_participants")
      .select("profile_id").eq("meeting_id",meeting.id).eq("profile_id",job.profile_id).maybeSingle();
    if (!participant) return null;
    return safeNotice("A meeting you're invited to starts soon.",job.id,{
      ordinary:true,actor:"CEAC Calendar",showPreview:preview,
    });
  }
  if (job.source_kind === "personal_reminder") {
    const { data: reminder } = await admin.from("personal_reminders")
      .select("id,org_id,profile_id,remind_at,seen_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("profile_id",job.profile_id).maybeSingle();
    if (!reminder || reminder.seen_at ||
        delayMs(reminder.remind_at) !== delayMs(job.source_due_at)) return null;
    return safeNotice("Your personal reminder is due.",job.id,{
      ordinary:true,actor:"CEAC Reminder",showPreview:preview,
    });
  }
  if (job.source_kind === "routine_reminder") {
    const { data: reminder } = await admin.from("routine_reminder_deliveries")
      .select("id,org_id,for_profile_id,work_item_id,due_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("for_profile_id",job.profile_id).maybeSingle();
    if (!reminder || delayMs(reminder.due_at) !== delayMs(job.source_due_at)) return null;
    const { data: work } = await admin.from("work_items")
      .select("id,kind,status,confidential").eq("id",reminder.work_item_id)
      .eq("org_id",job.org_id).maybeSingle();
    if (!work || work.kind !== "routine" || ["completed","cancelled"].includes(work.status)) return null;
    return safeNotice("Your scheduled responsibility is due.",job.id,{
      ordinary:!work.confidential,actor:"CEAC Work",showPreview:preview,
    });
  }
  if (job.source_kind === "calendar_reminder") {
    const { data: event } = await admin.from("personal_calendar_events")
      .select("id,org_id,profile_id,reminder_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("profile_id",job.profile_id).maybeSingle();
    if (!event || delayMs(event.reminder_at) !== delayMs(job.source_due_at)) return null;
    return safeNotice("An event on your calendar is coming up.",job.id,{
      ordinary:true,actor:"CEAC Calendar",showPreview:preview,
    });
  }
  return null;
}

async function dispatch(admin: any, conf: any) {
  if (!conf.publicKey || !conf.privateKey) return { enabled:false, processed:0 };
  webpush.setVapidDetails("mailto:ceairportcity@gmail.com",conf.publicKey,conf.privateKey);
  const { error: enqError } = await admin.rpc("ceac_enqueue_push_reminders");
  if (enqError) throw enqError;
  const { data: jobs, error: claimError } = await admin.rpc("ceac_claim_push_jobs", { p_limit:10 });
  if (claimError) throw claimError;
  let sent=0;
  for (const job of jobs || []) {
    let state="cancelled",retryAt:null|string=null,reason:null|string=null;
    try {
      if (Date.parse(job.expires_at) <= Date.now()) { reason="expired"; }
      else {
        const { data: sub } = await admin.from("ceac_push_subscriptions")
          .select("*").eq("id",job.subscription_id).maybeSingle();
        const payload = sub ? await describeJob(admin,job,sub) : null;
        if (payload && sub) {
          const subscription = validateSubscription({
            endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key},
          });
          const ttl = Math.max(0,Math.min(3600,Math.floor((Date.parse(job.expires_at)-Date.now())/1000)));
          let status:null|number=null;
          try {
            const response = await webpush.sendNotification(subscription,
              JSON.stringify({ notificationId: job.id, ...payload }),{ TTL:ttl, timeout:12000 });
            status=response?.statusCode || null;
          } catch (error) {
            status=Number.isInteger(error?.statusCode)?error.statusCode:null;
          }
          const outcome=deliveryOutcome(status,job.attempts,Date.now());
          if (outcome.state === "sent") { state="sent";sent++; }
          else if (outcome.state === "retry") {
            state="retry";retryAt=new Date(outcome.retryAt).toISOString();reason="transient";
          } else {
            state="cancelled";reason=outcome.state;
            if (outcome.state === "expired_subscription")
              await admin.from("ceac_push_subscriptions")
                .update({revoked_at:new Date().toISOString()}).eq("id",sub.id);
          }
        } else { reason="access_or_preference"; }
      }
    } catch {
      if (job.attempts >= 8) { state="failed";reason="retry_limit"; }
      else {
        state="retry";reason="delivery_error";
        retryAt=new Date(Date.now()+Math.min(3600000,30000*2**Math.max(0,job.attempts-1))).toISOString();
      }
    }
    const { error: finishError } = await admin.rpc("ceac_finish_push_job",{
      p_id:job.id,p_token:job.lease_token,p_state:state,
      p_retry_at:retryAt,p_failure_code:reason,
    });
    if (finishError) throw finishError;
  }
  return { enabled:true,processed:(jobs||[]).length,sent };
}
function workerTokenMatches(supplied: string, expected: string) {
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference=0;for(let i=0;i<supplied.length;i++)difference|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:responseHeaders});
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = getServiceKey();
  if (!projectUrl || !serviceKey) return reply(503,{message:"Push server is not configured."});
  const admin = createClient(projectUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const action=new URL(request.url).searchParams.get("action");
  if (action === "dispatch" && request.method === "POST") {
    const conf=await secrets(admin).catch(()=>null);
    if (!conf || !workerTokenMatches(request.headers.get("x-ceac-push-worker")||"",conf.workerToken||""))
      return reply(403,{message:"Forbidden"});
    try { return reply(200,await dispatch(admin,conf)); }
    catch { return reply(503,{message:"Push delivery is temporarily unavailable."}); }
  }
  const accessToken=(request.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
  if (!accessToken) return reply(401,{message:"Please sign in to CEAC."});
  const { data: auth,error:authError }=await admin.auth.getUser(accessToken);
  if (authError || !auth?.user) return reply(401,{message:"Please sign in to CEAC."});
  const person=await member(admin,auth.user.id);
  if (!person) return reply(403,{message:"Your CEAC access is inactive."});
  if (action === "config" && request.method === "GET") {
    const conf=await secrets(admin).catch(()=>null);
    return reply(200,{enabled:!!(conf?.publicKey&&conf?.privateKey),
      publicKey:conf?.publicKey||null});
  }
  if (request.method !== "POST") return reply(405,{message:"Unsupported request."});
  const length=Number(request.headers.get("content-length")||0);
  if(length>9000)return reply(413,{message:"Device registration is too large."});
  let body:any;try { body=await request.json(); }catch{return reply(400,{message:"Invalid request."});}
  if (action === "status") {
    if (typeof body?.endpoint !== "string" || body.endpoint.length>4096)
      return reply(400,{message:"Invalid device subscription."});
    const hash=await fingerprint(body.endpoint);
    const {data: subscription,error}=await admin.from("ceac_push_subscriptions")
      .select("id,preview_allowed").eq("endpoint_hash",hash)
      .eq("profile_id",person.id).eq("org_id",person.org_id)
      .is("revoked_at",null).maybeSingle();
    if(error)return reply(503,{message:"Device registration could not be checked."});
    return reply(200,{enabled:!!subscription,preview:subscription?.preview_allowed===true});
  }
  if (action === "subscribe") {
    let sub:any;try { sub=validateSubscription(body?.subscription); }
    catch { return reply(400,{message:"This device's push subscription is not valid."}); }
    const endpointHash=await fingerprint(sub.endpoint);
    const { data: existing,error:readError }=await admin.from("ceac_push_subscriptions")
      .select("id,org_id,profile_id").eq("endpoint_hash",endpointHash)
      .is("revoked_at",null).maybeSingle();
    if(readError)return reply(503,{message:"Device registration could not be checked."});
    if(existing && (existing.profile_id!==person.id||existing.org_id!==person.org_id))
      return reply(409,{message:"This browser is linked to another account. Disable notifications and subscribe again."});
    const values={
      org_id:person.org_id,profile_id:person.id,
      endpoint:sub.endpoint,endpoint_hash:endpointHash,
      p256dh:sub.keys.p256dh,auth_key:sub.keys.auth,
      preview_allowed:body?.showPreview===true,updated_at:new Date().toISOString(),
    };
    const result=existing
      ?await admin.from("ceac_push_subscriptions").update(values).eq("id",existing.id)
      :await admin.from("ceac_push_subscriptions").insert(values);
    if(result.error)return reply(503,{message:"Could not enable notifications on this device."});
    return reply(200,{enabled:true});
  }
  if (action === "unsubscribe") {
    if(typeof body?.endpoint!=="string"||body.endpoint.length>4096)
      return reply(400,{message:"Invalid subscription."});
    const hash=await fingerprint(body.endpoint);
    const {error}=await admin.from("ceac_push_subscriptions")
      .update({revoked_at:new Date().toISOString()})
      .eq("endpoint_hash",hash).eq("profile_id",person.id).eq("org_id",person.org_id);
    if(error)return reply(503,{message:"Could not update this device."});
    return reply(200,{enabled:false});
  }
  return reply(404,{message:"Unknown push operation."});
});
