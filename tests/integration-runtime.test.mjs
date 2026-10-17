import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasVerifiedTotpAal2, readBoundedActionBody, MAX_INTEGRATION_BODY_BYTES, MAX_INTEGRATION_DRAIN_BYTES,
} from "../supabase/functions/integration-runtime/mfa.mjs";
import {
  classifyTelegramFailure,
  safeNotificationText,
  telegramGetMe,
  telegramSendMessage,
} from "../supabase/functions/integration-runtime/telegram.mjs";

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

test("telegramGetMe exposes only verified bot identity", async () => {
  const calls = [];
  const result = await telegramGetMe({
    token: "123456:abcdefghijklmnopqrstuvwxyz",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { ok: true, result: { id: 99, username: "ceac_test_bot", first_name: "CEAC Test" } });
    },
    baseUrl: "https://telegram.test",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.bot, { id: "99", username: "ceac_test_bot", displayName: "CEAC Test" });
  assert.match(calls[0].url, /\/getMe$/);
});

test("telegramSendMessage sends only the requested privacy-safe text", async () => {
  let requestBody;
  const result = await telegramSendMessage({
    token: "123456:abcdefghijklmnopqrstuvwxyz",
    chatId: "-100123",
    text: "CEAC OS\nLeave requested\nOpen CEAC OS for details.",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response(200, { ok: true, result: { message_id: 1 } });
    },
    baseUrl: "https://telegram.test",
  });
  assert.equal(result.ok, true);
  assert.equal(requestBody.chat_id, "-100123");
  assert.equal(requestBody.text, "CEAC OS\nLeave requested\nOpen CEAC OS for details.");
  assert.equal("payload" in requestBody, false);
});

test("safeNotificationText never serializes raw event payloads", () => {
  const text = safeNotificationText({
    label: "Leave requested",
    occurredAt: "2026-09-26T06:00:00Z",
    payload: { private_note: "must not leave CEAC OS" },
  });
  assert.match(text, /^CEAC OS\nLeave requested\n/);
  assert.match(text, /Open CEAC OS for details\.$/);
  assert.equal(text.includes("private_note"), false);
  assert.equal(text.includes("must not leave"), false);
});

test("Telegram errors are classified for safe retry behaviour", () => {
  assert.deepEqual(classifyTelegramFailure(401, { description: "Unauthorized" }), {
    category: "auth", retryable: false, safeMessage: "Telegram rejected the bot credential.",
  });
  assert.equal(classifyTelegramFailure(429, {}).retryable, true);
  assert.equal(classifyTelegramFailure(503, {}).retryable, true);
  assert.deepEqual(classifyTelegramFailure(400, { description: "Bad Request: chat not found" }), {
    category: "destination", retryable: false, safeMessage: "Telegram could not use the configured chat destination.",
  });
});

test("integration Edge requires signed same-user AAL2 and TOTP method", () => {
  const userId = "synthetic-ceac-user";
  const valid = { sub: userId, role: "authenticated", aal: "aal2", amr: [{ method: "password" }, { method: "totp" }] };
  assert.equal(hasVerifiedTotpAal2(valid, userId), true);
  for (const claims of [
    undefined,
    { ...valid, sub: "different-user" },
    { ...valid, role: "service_role" },
    { ...valid, aal: "aal1" },
    { ...valid, amr: [{ method: "password" }] },
    { ...valid, amr: [{ method: "phone" }] },
    { ...valid, amr: "totp" },
    { ...valid, amr: [] },
  ]) {
    assert.equal(hasVerifiedTotpAal2(claims, userId), false);
  }
  assert.equal(hasVerifiedTotpAal2(valid, ""), false);
});

test("integration Edge policy check precedes privileged capability handling", () => {
  const source = readFileSync(new URL("../supabase/functions/integration-runtime/index.ts", import.meta.url), "utf8");
  const policyRead = source.indexOf('.select("universal_totp_required")');
  const signedClaimCheck = source.indexOf("hasVerifiedTotpAal2(verifiedToken?.claims, authData.user.id)");
  const capabilityRead = source.indexOf('client.rpc("app_has_capability"');
  assert.ok(policyRead > source.indexOf("async function userContext("));
  assert.ok(signedClaimCheck > policyRead && capabilityRead > signedClaimCheck);
  assert.match(source, /client\.auth\.getClaims\(accessToken\)/);
  assert.match(source, /orgPolicyError \|\| typeof orgPolicy\?\.universal_totp_required !== "boolean"/);
  assert.match(source, /if \(orgPolicy\.universal_totp_required\)/);
});

test("public integration Edge request rejects oversized and malformed bodies before authority dispatch", async () => {
  const request = (body, headers = {}) => new Request("https://isolated.test/functions/v1/integration-runtime", {
    method: "POST", headers, body,
  });
  assert.deepEqual(await readBoundedActionBody(request('{"action":"health.telegram"}')),
    { action: "health.telegram" });
  assert.deepEqual(await readBoundedActionBody(request("")), {});
  assert.equal(await readBoundedActionBody(request("{invalid-json")), null);
  assert.equal(await readBoundedActionBody(request('["worker"]')), null);
  assert.equal(await readBoundedActionBody(request('"worker"')), null);
  assert.equal(await readBoundedActionBody(request("null")), null);
  assert.deepEqual(await readBoundedActionBody(request(
    JSON.stringify({ a: "x".repeat(MAX_INTEGRATION_BODY_BYTES - 8) }),
  )).then((value) => value?.a?.length), MAX_INTEGRATION_BODY_BYTES - 8);
  assert.equal(await readBoundedActionBody(request("x".repeat(MAX_INTEGRATION_BODY_BYTES + 1))), null);
  assert.equal(await readBoundedActionBody(request('{"action":"worker"}', {
    "Content-Length": String(MAX_INTEGRATION_BODY_BYTES + 1),
  })), null);

  const edgeSource = readFileSync(new URL("../supabase/functions/integration-runtime/index.ts", import.meta.url), "utf8");
  assert.ok(edgeSource.includes("await readBoundedActionBody(req)"));
  assert.ok(edgeSource.includes('if (!body) return json({ error: "Invalid or oversized integration request." }, 400)'));
  assert.equal(edgeSource.includes("await req.json()"), false,
    "Unauthenticated Edge requests may not be read by an unbounded parser");
});

test("oversized Edge JSON denies without cancelling or waiting for the upload stream", async () => {
  let cancelCalled = false;
  let released = false;
  // Synthetic request stream whose cancellation never settles. If the Edge
  // guard awaits cancel(), a malicious upload can stall rejection indefinitely.
  const request = {
    headers: new Headers(),
    body: {
      getReader: () => ({
        read: async () => ({ done: false, value: new Uint8Array(MAX_INTEGRATION_BODY_BYTES + 1) }),
        cancel: () => {
          cancelCalled = true;
          return new Promise(() => {});
        },
        releaseLock: () => { released = true; },
      }),
    },
  };
  const verdict = await Promise.race([
    readBoundedActionBody(request),
    new Promise((resolve) => setTimeout(() => resolve("stalled"), 180)),
  ]);
  assert.equal(verdict, null, "Oversized unauthenticated body must be denied without awaiting cancel");
  assert.equal(cancelCalled, false, "The Edge body guard must not cancel an upstream local gateway stream");
  assert.equal(released, true);
});

// The isolated Edge HTTP gateway can hang when an oversized POST is rejected
// without consuming a modest already-declared request body. Drain only that
// bounded body to EOF; do not buffer it, cancel the stream, or accept its action.
test("small declared oversize Edge POST drains to EOF before rejecting without dispatch", async () => {
  const length = MAX_INTEGRATION_BODY_BYTES + 25;
  let reads = 0;
  let released = false;
  let cancelled = false;
  const request = {
    headers: new Headers({ "Content-Length": String(length) }),
    body: {
      getReader: () => ({
        async read() {
          reads += 1;
          return reads === 1
            ? { done: false, value: new Uint8Array(length) }
            : { done: true, value: undefined };
        },
        cancel() { cancelled = true; throw new Error("Must not cancel gateway request"); },
        releaseLock() { released = true; },
      }),
    },
  };
  assert.equal(await readBoundedActionBody(request), null);
  assert.equal(reads, 2, "Gateway request should reach EOF for a modest declared oversize body");
  assert.equal(released, true);
  assert.equal(cancelled, false);
});

test("huge declared oversize Edge POST rejects without reading an unbounded stream", async () => {
  let touched = false;
  const request = {
    headers: new Headers({ "Content-Length": String(MAX_INTEGRATION_DRAIN_BYTES + 1) }),
    body: { getReader() { touched = true; throw new Error("Do not drain huge payload"); } },
  };
  assert.equal(await readBoundedActionBody(request), null);
  assert.equal(touched, false);
});

test("malformed and unsafe declared Edge lengths fail closed without reading the body", async () => {
  for (const length of ["-1", "1.5", "1e8", "NaN", "9007199254740993"]) {
    let touched = false;
    const request = {
      headers: new Headers({ "Content-Length": length }),
      body: { getReader() { touched = true; throw new Error("Must not read invalid-length body"); } },
    };
    assert.equal(await readBoundedActionBody(request), null, length);
    assert.equal(touched, false, length);
  }
});
