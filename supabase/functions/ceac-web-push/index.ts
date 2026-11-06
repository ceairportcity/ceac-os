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
const read = async(query: any) => {const {data,error}=await query;if(error)throw error;return data;};
const member = async (admin: any, id: string) => {
  const data = await read(admin.from("profiles")
    .select("id,org_id,active,full_name,is_admin,is_exec").eq("id",id).maybeSingle());
  return data?.active ? data : null;
};
const actorDetails = async(admin: any,id: string,org: string) => {
 const person=await member(admin,id);
 if(!person || person.org_id!==org)return {full_name:"CEAC",department:""};
 const units = await read(admin.from("unit_memberships").select("units(name)").eq("profile_id",id).eq("org_id",org).order("unit_id").limit(4));
 return {...person,department:[...new Set((units||[]).map((row:any)=>row.units?.name).filter(Boolean))].join(" / ")};
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
  if (job.source_kind === "test") return {title:"CEAC",body:"Notifications are working on this device.",tag:"ceac-test",path:"/?tab=messages&updates=1"};
  const category = job.source_kind === "notice" ? "messages" : /work|routine/.test(job.source_kind) ? "work" : "calendar";
  if (job.source_kind !== "notice" && sub.categories?.[category] === false) return null;
  // Quiet hours defer rather than discard valid deliveries.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone:sub.timezone || "Africa/Accra",hour:"2-digit",hourCycle:"h23" }).format(new Date()));
  if (sub.quiet_start !== null && sub.quiet_end !== null &&
      (sub.quiet_start < sub.quiet_end ? hour >= sub.quiet_start && hour < sub.quiet_end : hour >= sub.quiet_start || hour < sub.quiet_end))
    {
      const now=new Date();const resume=new Date(now);resume.setUTCHours(sub.quiet_end,0,0,0);
      if(resume.getTime()<=now.getTime())resume.setUTCDate(resume.getUTCDate()+1);
      throw Object.assign(new Error("quiet_hours"),{retryAt:resume.toISOString()});
    }
  const compose = (message: string, options: Record<string,unknown> = {}, path = "/?tab=messages&updates=1", group = job.source_key) => ({
    ...safeNotice(message,job.id,{showPreview:preview,...options}),
    tag:"ceac-" + group, path,
  });
  if (job.source_kind === "notice") {
    const notice = await read(admin.from("ceac_notification_events")
      .select("id,org_id,recipient_id,context_kind,context_id,event_kind,source_event_id,actor_id,read_at")
      .eq("id",job.source_id).eq("recipient_id",job.profile_id).eq("org_id",job.org_id).maybeSingle());
    if (!notice || notice.read_at) return null;
    const noticeCategory=notice.event_kind==="room_activity"?"rooms":["work_item","routine_occurrence"].includes(notice.context_kind)?"work":notice.context_kind==="meeting"?"calendar":"messages";
    if((noticeCategory==="rooms" && sub.categories?.rooms!==true) || sub.categories?.[noticeCategory]===false)return null;
    const {data: visible,error: visibilityError}=await admin.rpc("ceac_push_context_visible",{p_kind:notice.context_kind,p_id:notice.context_id,p_profile:job.profile_id});
    if(visibilityError)throw visibilityError;
    if(!visible)return null;
    if(notice.context_kind==="routine_occurrence"){
      const occurrence = await read(admin.from("operation_occurrences").select("operation_id,occurred_on").eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle());
      if(!occurrence)return null;
      const operation = await read(admin.from("recurring_operations").select("work_item_id").eq("id",occurrence.operation_id).eq("org_id",job.org_id).maybeSingle());
      if(!operation)return null;
      const work = await read(admin.from("work_items").select("title,confidential").eq("id",operation.work_item_id).eq("org_id",job.org_id).maybeSingle());
      const review = await read(admin.from("routine_occurrence_reviews").select("id,decision,reviewer_id").eq("occurrence_id",notice.context_id).eq("org_id",job.org_id).order("reviewed_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle());
      if(!work || !review || review.id!==notice.source_event_id)return null;
      const actor=await actorDetails(admin,review.reviewer_id,job.org_id);
      const text=review.decision==="changes_requested"?"Changes requested":"Your work was accepted";
      return compose(text+": "+work.title+" · "+occurrence.occurred_on,{ordinary:!work.confidential,actor:actor.full_name,department:actor.department},"/?tab=work&item="+operation.work_item_id+"&routineDate="+occurrence.occurred_on,"routine:"+operation.work_item_id+":"+occurrence.occurred_on);
    }
    if (notice.context_kind === "meeting") {
      const meeting = await read(admin.from("meeting_sessions").select("id,title,status,created_by").eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle());
      if(!meeting || notice.event_kind!=="meeting_cancelled" && /cancel/i.test(meeting.status||""))return null;
      const actor=await actorDetails(admin,notice.actor_id||meeting.created_by,job.org_id);
      const wording=notice.event_kind==="meeting_cancelled"?"Meeting cancelled":notice.event_kind==="meeting_changed"?"Meeting updated":"Invited you to a meeting";
      return compose(wording+": "+meeting.title,{ordinary:true,actor:actor?.full_name||"CEAC Calendar",department:actor?.department},"/?tab=home&meeting="+meeting.id,"meeting:"+meeting.id);
    }
    if(notice.context_kind==="leave")return compose("",{},"/?tab=attendance&leave="+notice.context_id,"leave:"+notice.context_id);
    if(notice.context_kind==="room"){
      const preference = await read(admin.from("room_notification_preferences").select("notification_level").eq("room_id",notice.context_id).eq("profile_id",job.profile_id).maybeSingle());
      if(preference?.notification_level==="mute" || notice.event_kind==="room_activity" && (preference?.notification_level||(user.is_admin||user.is_exec?"mentions":"all"))!=="all")return null;
      const message = await read(admin.from("room_messages").select("id,author_id,created_at").eq("id",notice.source_event_id).eq("room_id",notice.context_id).maybeSingle());
      if(!message)return null;
      if(!await read(admin.rpc("ceac_push_room_message_current",{p_message:message.id,p_profile:job.profile_id})))return null;
      const roomRead = await read(admin.from("room_reads").select("last_read_at").eq("room_id",notice.context_id).eq("profile_id",job.profile_id).maybeSingle());
      if(roomRead && Date.parse(roomRead.last_read_at)>=Date.parse(message.created_at))return null;
      const actor=await actorDetails(admin,message.author_id,job.org_id);
      return compose(notice.event_kind==="room_activity"?"Sent a message in a Room.":"Mentioned you in a Room.",{ordinary:true,actor:actor?.full_name||"CEAC",department:actor?.department},"/?tab=messages&room="+notice.context_id,"room:"+notice.context_id);
    }
    if (notice.context_kind === "memo") {
      const memo = await read(admin.from("memos")
        .select("id,org_id,sender_id,status,confidential").eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle());
      if (!memo || memo.status === "draft") return null;
      const recipient = await read(admin.from("memo_recipients")
        .select("profile_id").eq("memo_id",memo.id).eq("profile_id",job.profile_id).maybeSingle());
      if (!recipient && memo.sender_id !== job.profile_id) return null;
      let actorId = memo.sender_id;
      if (notice.event_kind === "memo_response") {
        const exchange = await read(admin.from("memo_exchanges").select("author_id")
          .eq("id",notice.source_event_id).eq("memo_id",memo.id).maybeSingle());
        if (!exchange) return null;
        actorId = exchange.author_id;
      }
      const sender = await member(admin,actorId);
      if (preview && sender && memo.confidential === false) {
        const memberships = await read(admin.from("unit_memberships")
          .select("units(name)").eq("profile_id",sender.id).limit(1));
        const department = memberships?.[0]?.units?.name || "";
        return compose(notice.event_kind === "memo_response" ? "Replied to your memo." : "Sent you a memo.",{
          ordinary:true,actor:sender.full_name,department,
        },"/?tab=messages&memo="+memo.id,"memo:"+memo.id);
      }
      return compose("",{},"/?tab=messages&memo="+memo.id,"memo:"+memo.id);
    }
    if (notice.context_kind === "work_item") {
      const work = await read(admin.from("work_items")
        .select("id,org_id,assignee_id,assigned_by,status,confidential,title")
        .eq("id",notice.context_id).eq("org_id",job.org_id).maybeSingle());
      if (!work) return null;
      const allowed = await read(admin.rpc("ceac_push_work_recipient", {p_work:work.id,p_profile:job.profile_id,p_event:notice.event_kind}));
      if (!allowed) return null;
      if (notice.event_kind === "work_assigned" && !activeWorkStatus.has(work.status)) return null;
      if (notice.event_kind === "work_returned" && work.status!=="returned")return null;
      if (notice.event_kind === "work_approved" && work.status!=="completed")return null;
      const actor = await actorDetails(admin, notice.actor_id || (notice.event_kind === "work_submitted" ? work.assignee_id : work.assigned_by),job.org_id);
      const text = notice.event_kind === "work_submitted" ? "Submitted work for your review"
        : notice.event_kind === "work_returned" ? "Changes requested"
        : notice.event_kind === "work_approved" ? "Your work was approved" : "Assigned work to you";
      return compose(work.confidential ? "" : text+": "+work.title,{
        ordinary:!work.confidential,actor:actor?.full_name||"CEAC Work",department:actor?.department,
      },"/?tab=work&item="+work.id,"work:"+work.id);
    }
    // Other authoritative personal notices contain no private source data.
    return safeNotice("",job.id);
  }
  if (job.source_kind === "work_due" || job.source_kind === "work_overdue") {
    const work = await read(admin.from("work_items")
      .select("id,org_id,assignee_id,kind,status,confidential,title,due_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("assignee_id",job.profile_id).maybeSingle());
    if (!work || work.kind === "routine" || !activeWorkStatus.has(work.status) ||
        delayMs(work.due_at) !== delayMs(job.source_due_at)) return null;
    const message = job.source_kind === "work_overdue"
      ? "Your assigned work is past due. Open CEAC to update it."
      : "Your assigned work is due soon.";
    return compose(message+" "+work.title,{ordinary:!work.confidential,actor:"CEAC Work"},"/?tab=work&item="+work.id,"work:"+work.id);
  }
  if (job.source_kind === "meeting_reminder") {
    const meeting = await read(admin.from("meeting_sessions")
      .select("id,org_id,status,starts_at,title,created_by")
      .eq("id",job.source_id).eq("org_id",job.org_id).maybeSingle());
    if (!meeting || /cancel/i.test(meeting.status || "") ||
        delayMs(meeting.starts_at) !== delayMs(job.source_due_at)) return null;
    const participant = await read(admin.from("meeting_participants")
      .select("profile_id").eq("meeting_id",meeting.id).eq("profile_id",job.profile_id).maybeSingle());
    if (!participant && meeting.created_by !== job.profile_id) return null;
    const organiser = await actorDetails(admin,meeting.created_by,job.org_id);
    return compose("Meeting starts soon: "+meeting.title,{ordinary:true,actor:organiser?.full_name||"CEAC Calendar",department:organiser?.department},"/?tab=home&meeting="+meeting.id,"meeting:"+meeting.id);
  }
  if (job.source_kind === "personal_reminder") {
    const reminder = await read(admin.from("personal_reminders")
      .select("id,org_id,profile_id,remind_at,seen_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("profile_id",job.profile_id).maybeSingle());
    if (!reminder || reminder.seen_at ||
        delayMs(reminder.remind_at) !== delayMs(job.source_due_at)) return null;
    return compose("Your personal reminder is due.",{ordinary:true,actor:"CEAC Reminder"},"/?tab=me&reminder="+reminder.id,"reminder:"+reminder.id);
  }
  if (job.source_kind === "routine_reminder") {
    const reminder = await read(admin.from("routine_reminder_deliveries")
      .select("id,org_id,for_profile_id,work_item_id,due_at,scheduled_on")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("for_profile_id",job.profile_id).maybeSingle());
    if (!reminder || delayMs(reminder.due_at) !== delayMs(job.source_due_at)) return null;
    const {data: current,error: currentError} = await admin.rpc("ceac_push_routine_current",{p_reminder:reminder.id,p_profile:job.profile_id});
    if (currentError) throw currentError;
    if (!current) return null;
    const work = await read(admin.from("work_items")
      .select("id,kind,status,confidential").eq("id",reminder.work_item_id)
      .eq("org_id",job.org_id).maybeSingle());
    if (!work || work.kind !== "routine" || ["completed","cancelled"].includes(work.status)) return null;
    return compose("Your scheduled responsibility is due for "+reminder.scheduled_on+".",{ordinary:!work.confidential,actor:"CEAC Work"},"/?tab=work&item="+reminder.work_item_id+"&routineDate="+reminder.scheduled_on,"routine:"+reminder.work_item_id+":"+reminder.scheduled_on);
  }
  if (job.source_kind === "calendar_reminder") {
    const event = await read(admin.from("personal_calendar_events")
      .select("id,org_id,profile_id,reminder_at,starts_at")
      .eq("id",job.source_id).eq("org_id",job.org_id).eq("profile_id",job.profile_id).maybeSingle());
    if (!event || delayMs(event.reminder_at) !== delayMs(job.source_due_at)) return null;
    return compose("An event on your calendar is coming up.",{ordinary:true,actor:"CEAC Calendar"},"/?tab=personal-calendar&date="+event.starts_at.slice(0,10)+"&event="+event.id,"calendar:"+event.id);
  }
  return null;
}

async function dispatchBatch(admin: any, conf: any) {
  if (!conf.publicKey || !conf.privateKey) return { enabled:false, processed:0 };
  webpush.setVapidDetails("mailto:ceairportcity@gmail.com",conf.publicKey,conf.privateKey);
  const { data: jobs, error: claimError } = await admin.rpc("ceac_claim_push_jobs", { p_limit:20 });
  if (claimError) throw claimError;
  let sent=0;
  const pending = [...(jobs || [])];
  const deliver = async (job: any) => {
    let state="cancelled",retryAt:null|string=null,reason:null|string=null;
    try {
      if (Date.parse(job.expires_at) <= Date.now()) { reason="expired"; }
      else {
        const sub = await read(admin.from("ceac_push_subscriptions")
          .select("*").eq("id",job.subscription_id).maybeSingle());
        const payload = sub ? await describeJob(admin,job,sub) : null;
        if (payload && sub) {
          const unreadCount = await read(admin.rpc("ceac_push_unread_count",{p_profile:job.profile_id}));
          if(!Number.isInteger(unreadCount)||unreadCount<0)throw new Error("Unread count unavailable");
          const subscription = validateSubscription({
            endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key},
          });
          const ttl = Math.max(0,Math.min(3600,Math.floor((Date.parse(job.expires_at)-Date.now())/1000)));
          let status:null|number=null;
          try {
            const response = await webpush.sendNotification(subscription,
              JSON.stringify({ notificationId: job.id, ...payload, unreadCount:Number(unreadCount)||0,
                ...(sub.app_origin ? {web_push:8030,notification:{title:payload.title,body:payload.body,
                  navigate:new URL(payload.path||"/?tab=messages&updates=1",sub.app_origin).href,
                  tag:payload.tag,data:{notificationId:job.id,path:payload.path},icon:new URL("/ceac-icon-192.png",sub.app_origin).href,app_badge:String(Number(unreadCount)||0)}} : {}) }),{ TTL:ttl, timeout:12000 });
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
    } catch (error) {
      if(error?.message === "quiet_hours"){
        reason="quiet_hours";retryAt=error.retryAt;
        state=Date.parse(retryAt||"")<Date.parse(job.expires_at)?"retry":"cancelled";
      } else if (job.attempts >= 8) { state="failed";reason="retry_limit"; }
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
  };
  await Promise.all(Array.from({length:Math.min(5,pending.length)},async()=>{
    while(pending.length) await deliver(pending.shift());
  }));
  return { enabled:true,processed:(jobs||[]).length,sent };
}
async function dispatch(admin: any,conf: any){
 if(!conf.publicKey || !conf.privateKey)return {enabled:false,processed:0,sent:0};
 const {error}=await admin.rpc("ceac_enqueue_push_reminders");if(error)throw error;
 const started=Date.now();let processed=0,sent=0;
 for(let batch=0;batch<3 && Date.now()-started<50000;batch++){
  const result=await dispatchBatch(admin,conf);processed+=result.processed;sent+=result.sent||0;
  if(!result.enabled || result.processed<20)break;
 }
 return {enabled:true,processed,sent};
}
function workerTokenMatches(supplied: string, expected: string) {
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference=0;for(let i=0;i<supplied.length;i++)difference|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}

function allowedOrigin(origin: string|null) {
 if(!origin)return null;
 try{const url=new URL(origin);return url.protocol==="https:" && /^(ceac-os(?:-git)?\.vercel\.app|ceac-os(?:-git-main)?-thestandardinst-6345s-projects\.vercel\.app|ceac-[a-z0-9]+-thestandardinst-6345s-projects\.vercel\.app)$/.test(url.hostname) ? url.origin : null;}catch{return null;}
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
    EdgeRuntime.waitUntil(dispatch(admin,conf).catch(()=>console.error("ceac_push_dispatch_failed")));
    return reply(202,{accepted:true});
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
      .select("id,preview_allowed,categories,quiet_start,quiet_end,timezone,reminder_minutes").eq("endpoint_hash",hash)
      .eq("profile_id",person.id).eq("org_id",person.org_id)
      .is("revoked_at",null).maybeSingle();
    if(error)return reply(503,{message:"Device registration could not be checked."});
    const origin=allowedOrigin(request.headers.get("origin"));
    if(subscription && origin)await admin.from("ceac_push_subscriptions").update({app_origin:origin}).eq("id",subscription.id);
    return reply(200,{enabled:!!subscription,preview:subscription?.preview_allowed===true,preferences:subscription ? {categories:subscription.categories,quietStart:subscription.quiet_start,quietEnd:subscription.quiet_end,timezone:subscription.timezone,reminderMinutes:subscription.reminder_minutes} : null});
  }
  if (action === "preferences" || action === "test") {
    if (typeof body?.endpoint !== "string" || body.endpoint.length>4096) return reply(400,{message:"Invalid device."});
    const hash=await fingerprint(body.endpoint);
    const device = await read(admin.from("ceac_push_subscriptions").select("id,updated_at")
      .eq("endpoint_hash",hash).eq("profile_id",person.id).eq("org_id",person.org_id).is("revoked_at",null).maybeSingle());
    if(!device)return reply(404,{message:"Enable notifications on this device first."});
    if(action === "test") {
      const {error}=await admin.rpc("ceac_push_test",{p_device:device.id,p_profile:person.id});
      return error ? reply(429,{message:"Please wait a minute before sending another test."}) : reply(200,{queued:true});
    }
    const settings=body.preferences;
    if(!settings || ![null,...Array.from({length:24},(_,i)=>i)].includes(settings.quietStart) ||
      ![null,...Array.from({length:24},(_,i)=>i)].includes(settings.quietEnd) ||
      (settings.quietStart===null)!==(settings.quietEnd===null) || settings.quietStart!==null && settings.quietStart===settings.quietEnd)
      return reply(400,{message:"Choose a valid quiet-hours period."});
    if(![5,15,30,60].includes(settings.reminderMinutes))return reply(400,{message:"Choose a reminder time."});
    const categories=Object.fromEntries(["messages","work","calendar","rooms"].map(key=>[key,key==="rooms"?settings.categories?.[key]===true:settings.categories?.[key]!==false]));
    const {error}=await admin.from("ceac_push_subscriptions").update({categories,reminder_minutes:settings.reminderMinutes,quiet_start:settings.quietStart,quiet_end:settings.quietEnd,
      preview_allowed:body.showPreview===true,timezone:"Africa/Accra",updated_at:new Date().toISOString()}).eq("id",device.id);
    return error?reply(503,{message:"Preferences could not be saved."}):reply(200,{saved:true});
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
      preview_allowed:body?.showPreview===true,app_origin:allowedOrigin(request.headers.get("origin")),updated_at:new Date().toISOString(),
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
