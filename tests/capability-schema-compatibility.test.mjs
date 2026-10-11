import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMissingCapabilityExpiryColumn, resolveCapabilityGrantRead }
  from "../src/lib/capabilitySchemaCompatibility.js";

const exactLegacyError = {
  code: "42703",
  message: "column capability_grants.expires_at does not exist",
};

test("only the verified missing expiry column error can enable preview compatibility", () => {
  assert.equal(isMissingCapabilityExpiryColumn(exactLegacyError), true);
  assert.equal(isMissingCapabilityExpiryColumn({
    code: "42703", message: "column profiles.email does not exist",
  }), false);
  assert.equal(isMissingCapabilityExpiryColumn({
    code: "42501", message: exactLegacyError.message,
  }), false);
  assert.equal(isMissingCapabilityExpiryColumn({
    code: "PGRST204", message: "Could not find expires_at in the schema cache",
  }), false);
  assert.equal(isMissingCapabilityExpiryColumn(null), false);
});

test("older database loads identity without treating legacy grants as unlimited", () => {
  const result = resolveCapabilityGrantRead({
    data: [{ capability: "authority.manage", expires_at: null }],
    error: exactLegacyError,
  });
  assert.deepEqual(result.grants, [], "fail closed on all delegated capabilities");
  assert.equal(result.capabilitySchemaReady, false);
  assert.equal(result.error, null);
});

test("current schema keeps grants for normal server-authorised filtering", () => {
  const grant = { capability: "people.manage", expires_at: "2027-01-01T00:00:00Z" };
  const result = resolveCapabilityGrantRead({ data: [grant], error: null });
  assert.deepEqual(result.grants, [grant]);
  assert.equal(result.capabilitySchemaReady, true);
  assert.equal(result.error, null);
});

test("unrelated account/database errors still fail rather than hiding a problem", () => {
  const error = { code: "42501", message: "permission denied for capability_grants" };
  const result = resolveCapabilityGrantRead({ data: [], error });
  assert.equal(result.error, error);
  assert.equal(result.capabilitySchemaReady, false);
  assert.deepEqual(result.grants, []);
});

test("account loader and visible preview warning both enforce compatibility mode", () => {
  const loader = readFileSync("src/lib/supabase.js", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");
  assert.match(loader, /resolveCapabilityGrantRead\(\{ data: capabilityGrants, error: capabilityError \}\)/);
  assert.match(loader, /if \(resolvedCapabilityError\) throw resolvedCapabilityError;/);
  assert.match(loader, /capabilitySchemaReady,/);
  assert.match(app, /me\.capabilitySchemaReady === false/);
  assert.match(app, /Delegated capability-based\s+actions are unavailable here/);
  assert.doesNotMatch(app, /force.*mfa.*false/i);
});
