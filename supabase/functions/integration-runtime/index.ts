import { createClient } from "npm:@supabase/supabase-js@2";
import { safeNotificationText, telegramGetMe, telegramSendMessage } from "./telegram.mjs";
import { hasVerifiedTotpAal2 } from "./mfa.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ceac-worker-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function defaultKey(jsonName: string, legacyName: string) {
  const packed = Deno.env.get(jsonName);
  if (packed) {
    try {
      const parsed = JSON.parse(packed);
      if (parsed?.default) return parsed.default;
    } catch {}
  }
  return Deno.env.get(legacyName) || "";
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const publishableKey = defaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secretKey = defaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const telegramBaseUrl = Deno.env.get("CEAC_TELEGRAM_API_BASE") || "https://api.telegram.org";

function adminClient() {
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userContext(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return { error: json({ error: "Sign in to manage Connected Apps." }, 401) };

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { error: json({ error: "Your session could not be verified." }, 401) };

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,org_id,active")
    .eq("id", authData.user.id)
    .single();
  if (profileError || !profile?.active) return { error: json({ error: "Your CEAC profile is not active." }, 403) };

  // Stage 2 Edge defence in depth: provider-signed assurance is required
  // independently of the browser gate before any service-role action.
  // The organisational switch remains OFF until separately authorised P9.
  const { data: orgPolicy, error: orgPolicyError } = await adminClient()
    .from("organisations")
    .select("universal_totp_required")
    .eq("id", profile.org_id)
    .single();
  if (orgPolicyError || typeof orgPolicy?.universal_totp_required !== "boolean") {
    return { error: json({ error: "Your organisation's authentication policy could not be checked." }, 403) };
  }
  if (orgPolicy.universal_totp_required) {
    const accessToken = authorization.slice("Bearer ".length);
    // Verify this exact bearer via the provider; never trust client metadata
    // or an AAL2 boolean stored in a browser.
    const { data: verifiedToken, error: claimsError } = await client.auth.getClaims(accessToken);
    if (claimsError || !hasVerifiedTotpAal2(verifiedToken?.claims, authData.user.id)) {
      return { error: json({ error: "Verify your authenticator to manage Connected Apps." }, 403) };
    }
  }

  const { data: allowed, error: capabilityError } = await client.rpc("app_has_capability", {
    p_capability: "integration.manage",
    p_unit_id: null,
  });
  if (capabilityError || !allowed) return { error: json({ error: "You do not have authority to manage Connected Apps." }, 403) };

  return { client, user: authData.user, profile };
}

async function connectorForProvider(client: ReturnType<typeof createClient>, orgId: string, providerKey: string) {
  const { data, error } = await client
    .from("integration_connectors")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider_key", providerKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function connectTelegram(req: Request, body: any) {
  const context = await userContext(req);
  if ("error" in context) return context.error;

  const token = String(body?.token || "").trim();
  const chatId = String(body?.chat_id || "").trim();
  if (token.length < 20 || !token.includes(":")) return json({ error: "Enter a valid Telegram bot token." }, 400);
  if (!chatId) return json({ error: "Enter the Telegram chat ID that should receive CEAC notifications." }, 400);

  const admin = adminClient();
  const { data: connectorId, error: upsertError } = await admin.rpc("integration_service_upsert_connector", {
    p_org_id: context.profile.org_id,
    p_provider_key: "telegram",
    p_display_name: "Telegram",
    p_public_config: { chat_id: chatId },
    p_actor_id: context.user.id,
  });
  if (upsertError || !connectorId) return json({ error: "CEAC OS could not prepare the Telegram connection." }, 500);

  const { data: connector } = await admin.from("integration_connectors").select("*").eq("id", connectorId).single();
  if (connector?.connection_state === "connected") {
    return json({ error: "Telegram is already connected. Disconnect or use Check connection." }, 409);
  }

  if (connector?.connection_state !== "connecting") {
    const { error: transitionError } = await admin.rpc("integration_service_transition_connection", {
      p_connector_id: connectorId,
      p_to_state: "connecting",
      p_action: "Connection initiated",
      p_actor_id: context.user.id,
      p_account_label: null,
      p_account_identifier: null,
      p_scopes: [],
      p_capabilities: [],
      p_error_category: null,
      p_safe_detail: "Telegram connection verification started.",
    });
    if (transitionError) return json({ error: "CEAC OS could not start the Telegram connection." }, 409);
  }

  const me = await telegramGetMe({ token, baseUrl: telegramBaseUrl });
  if (!me.ok) {
    await admin.rpc("integration_service_transition_connection", {
      p_connector_id: connectorId,
      p_to_state: "error",
      p_action: "Connection verification failed",
      p_actor_id: context.user.id,
      p_account_label: null,
      p_account_identifier: null,
      p_scopes: [],
      p_capabilities: [],
      p_error_category: me.category,
      p_safe_detail: me.safeMessage,
    });
    return json({ error: me.safeMessage, category: me.category }, 400);
  }

  const test = await telegramSendMessage({
    token,
    chatId,
    text: "CEAC OS connected successfully. Future notifications will contain a short event label and direct you back to CEAC OS for details.",
    baseUrl: telegramBaseUrl,
  });
  if (!test.ok) {
    await admin.rpc("integration_service_transition_connection", {
      p_connector_id: connectorId,
      p_to_state: "error",
      p_action: "Destination verification failed",
      p_actor_id: context.user.id,
      p_account_label: null,
      p_account_identifier: null,
      p_scopes: [],
      p_capabilities: [],
      p_error_category: test.category,
      p_safe_detail: test.safeMessage,
    });
    return json({ error: test.safeMessage, category: test.category }, 400);
  }

  const { error: secretError } = await admin.rpc("integration_service_store_secret", {
    p_connector_id: connectorId,
    p_provider_key: "telegram",
    p_secret: token,
    p_secret_kind: "bot_token",
  });
  if (secretError) return json({ error: "Telegram verified, but CEAC OS could not secure the credential." }, 500);

  const { error: connectedError } = await admin.rpc("integration_service_transition_connection", {
    p_connector_id: connectorId,
    p_to_state: "connected",
    p_action: "Provider connected",
    p_actor_id: context.user.id,
    p_account_label: me.bot?.username ? "@" + me.bot.username : me.bot?.displayName,
    p_account_identifier: me.bot?.id,
    p_scopes: ["send_messages"],
    p_capabilities: ["send_notification"],
    p_error_category: null,
    p_safe_detail: "Telegram bot and destination verified.",
  });
  if (connectedError) return json({ error: "Telegram verified, but CEAC OS could not finish the connection." }, 500);

  return json({
    ok: true,
    provider: "telegram",
    connection_state: "connected",
    account_label: me.bot?.username ? "@" + me.bot.username : me.bot?.displayName,
  });
}

async function healthTelegram(req: Request) {
  const context = await userContext(req);
  if ("error" in context) return context.error;
  const admin = adminClient();
  const connector = await connectorForProvider(context.client, context.profile.org_id, "telegram");
  if (!connector) return json({ error: "Telegram is not configured." }, 404);

  const { data: token, error: tokenError } = await admin.rpc("integration_service_read_secret", { p_connector_id: connector.id });
  if (tokenError || !token) return json({ error: "Telegram credential is unavailable. Reconnect the provider." }, 409);

  const me = await telegramGetMe({ token, baseUrl: telegramBaseUrl });
  if (!me.ok) {
    await admin.rpc("integration_service_transition_connection", {
      p_connector_id: connector.id,
      p_to_state: "needs_reconnect",
      p_action: "Health check failed",
      p_actor_id: context.user.id,
      p_account_label: null,
      p_account_identifier: null,
      p_scopes: connector.granted_scopes || [],
      p_capabilities: connector.advertised_capabilities || [],
      p_error_category: me.category,
      p_safe_detail: me.safeMessage,
    });
    return json({ ok: false, connection_state: "needs_reconnect", error: me.safeMessage }, 409);
  }

  await admin.rpc("integration_service_transition_connection", {
    p_connector_id: connector.id,
    p_to_state: "connected",
    p_action: "Health check passed",
    p_actor_id: context.user.id,
    p_account_label: me.bot?.username ? "@" + me.bot.username : me.bot?.displayName,
    p_account_identifier: me.bot?.id,
    p_scopes: ["send_messages"],
    p_capabilities: ["send_notification"],
    p_error_category: null,
    p_safe_detail: "Telegram credential verified.",
  });

  return json({ ok: true, connection_state: "connected" });
}

async function disconnectTelegram(req: Request) {
  const context = await userContext(req);
  if ("error" in context) return context.error;
  const admin = adminClient();
  const connector = await connectorForProvider(context.client, context.profile.org_id, "telegram");
  if (!connector || connector.connection_state === "revoked") return json({ ok: true, connection_state: "revoked" });

  const { error: transitionError } = await admin.rpc("integration_service_transition_connection", {
    p_connector_id: connector.id,
    p_to_state: "revoked",
    p_action: "Provider disconnected",
    p_actor_id: context.user.id,
    p_account_label: null,
    p_account_identifier: null,
    p_scopes: connector.granted_scopes || [],
    p_capabilities: connector.advertised_capabilities || [],
    p_error_category: null,
    p_safe_detail: "Telegram connection revoked by an authorised CEAC administrator.",
  });
  if (transitionError) return json({ error: "Telegram could not be disconnected." }, 409);

  await admin.rpc("integration_service_delete_secret", { p_connector_id: connector.id });
  return json({ ok: true, connection_state: "revoked" });
}

async function setSubscription(req: Request, body: any) {
  const context = await userContext(req);
  if ("error" in context) return context.error;
  const connectorId = String(body?.connector_id || "");
  const eventType = String(body?.event_type || "");
  const active = body?.active !== false;
  if (!connectorId || !eventType) return json({ error: "Choose a provider and CEAC event." }, 400);

  const { data: connector, error: connectorError } = await context.client
    .from("integration_connectors")
    .select("id,connection_state,advertised_capabilities")
    .eq("id", connectorId)
    .single();
  if (connectorError || !connector) return json({ error: "That connection is not available to you." }, 404);
  if (active && (connector.connection_state !== "connected" || !(connector.advertised_capabilities || []).includes("send_notification"))) {
    return json({ error: "Connect and verify the provider before enabling notifications." }, 409);
  }

  const admin = adminClient();
  const { data: id, error } = await admin.rpc("integration_service_set_subscription", {
    p_connector_id: connectorId,
    p_event_type: eventType,
    p_active: active,
    p_actor_id: context.user.id,
  });
  if (error) return json({ error: "The notification subscription could not be updated." }, 400);
  return json({ ok: true, subscription_id: id, active });
}

async function runWorker(req: Request) {
  const workerKey = req.headers.get("x-ceac-worker-key") || "";
  if (!workerKey) return json({ error: "Worker authentication required." }, 401);
  const admin = adminClient();
  const { data: verified, error: verifyError } = await admin.rpc("integration_service_verify_worker_key", { p_key: workerKey });
  if (verifyError || !verified) return json({ error: "Worker authentication failed." }, 401);

  const { data: claims, error: claimError } = await admin.rpc("integration_service_claim_outbox", { p_limit: 20 });
  if (claimError) return json({ error: "The integration queue could not be claimed." }, 500);

  let delivered = 0, failed = 0;
  for (const item of claims || []) {
    let outcome;
    if (item.provider_key !== "telegram") {
      outcome = { ok: false, status: 0, category: "adapter_missing", retryable: false, safeMessage: "No provider adapter is available for this connection." };
    } else {
      const { data: token } = await admin.rpc("integration_service_read_secret", { p_connector_id: item.connector_id });
      const chatId = item.public_config?.chat_id;
      if (!token) outcome = { ok: false, status: 0, category: "auth", retryable: false, safeMessage: "Provider credential is unavailable." };
      else if (!chatId) outcome = { ok: false, status: 0, category: "destination", retryable: false, safeMessage: "Telegram chat destination is not configured." };
      else outcome = await telegramSendMessage({
        token,
        chatId,
        text: safeNotificationText({ label: item.event_label, occurredAt: item.occurred_at }),
        baseUrl: telegramBaseUrl,
      });
    }

    const { error: finishError } = await admin.rpc("integration_service_finish_delivery", {
      p_attempt_id: item.attempt_id,
      p_outbox_id: item.outbox_id,
      p_success: Boolean(outcome.ok),
      p_retryable: Boolean(outcome.retryable),
      p_provider_status_code: outcome.status || null,
      p_error_category: outcome.ok ? null : outcome.category,
      p_safe_message: outcome.ok ? null : outcome.safeMessage,
    });
    if (finishError) failed += 1;
    else if (outcome.ok) delivered += 1;
    else failed += 1;
  }

  return json({ ok: true, claimed: (claims || []).length, delivered, failed });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = String(body?.action || "");

  try {
    if (action === "connect.telegram") return await connectTelegram(req, body);
    if (action === "health.telegram") return await healthTelegram(req);
    if (action === "disconnect.telegram") return await disconnectTelegram(req);
    if (action === "subscription.set") return await setSubscription(req, body);
    if (action === "worker") return await runWorker(req);
    return json({ error: "Unsupported integration action." }, 400);
  } catch {
    return json({ error: "The integration runtime could not complete that request." }, 500);
  }
});
