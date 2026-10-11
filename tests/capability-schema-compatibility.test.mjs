import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMissingCapabilityExpiryColumn, resolveCapabilityGrantRead, readServerVerifiedLegacyGrants }
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
  assert.match(app, /me\.legacyAuthorityVerified/);
  assert.match(loader, /readServerVerifiedLegacyGrants\(supabase, auth\.user\.id, p\.org_id\)/);
  assert.doesNotMatch(app, /force.*mfa.*false/i);
});


function stubLegacyServer({ rows = [], authorizer = () => true, readError = null } = {}) {
  const scope = { profile_id: null, org_id: null, revoked_at: null };
  const request = {
    select: () => request,
    eq: (key, value) => { scope[key] = value; return request; },
    is: (key, value) => { scope[key] = value; return Promise.resolve({ data: rows, error: readError }); },
  };
  const calls = [];
  const supabase = {
    from: (table) => {
      assert.equal(table, "capability_grants");
      return request;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      assert.equal(name, "app_has_capability");
      const result = await authorizer(args);
      return result && typeof result === "object" && "error" in result
        ? result : { data: result, error: null };
    },
  };
  return { supabase, calls, scope };
}

test("pre-S3 Admin permission appears only after signed-in server RPC approves it", async () => {
  const rows = [{ id:"g1", capability:"people.manage", scope_unit_id:null }];
  const fixture = stubLegacyServer({ rows, authorizer: () => true });
  const result = await readServerVerifiedLegacyGrants(fixture.supabase,"me","org");
  assert.deepEqual(result.grants, rows);
  assert.equal(result.verificationComplete,true);
  assert.deepEqual(fixture.calls[0],{
    name:"app_has_capability",
    args:{p_capability:"people.manage",p_unit_id:null},
  });
  assert.equal(fixture.scope.profile_id,"me");
  assert.equal(fixture.scope.org_id,"org");
  assert.equal(fixture.scope.revoked_at,null);
});

test("server rejection never authorizes a legacy people-admin capability", async () => {
  const fixture = stubLegacyServer({
    rows: [{capability:"people.manage",scope_unit_id:null}],
    authorizer:()=>false,
  });
  const result = await readServerVerifiedLegacyGrants(fixture.supabase,"me","org");
  assert.deepEqual(result.grants,[]);
  assert.equal(result.verificationComplete,true);
});

test("scoped permission is sent to the server with exact scope", async () => {
  const fixture = stubLegacyServer({
    rows: [{capability:"work.manage",scope_unit_id:"unit-a"}],
    authorizer:({p_unit_id})=>p_unit_id==="unit-a",
  });
  const result = await readServerVerifiedLegacyGrants(fixture.supabase,"me","org");
  assert.equal(result.grants.length,1);
  assert.equal(fixture.calls[0].args.p_unit_id,"unit-a");
});

test("unavailable authorisation denies every grant even if others were approved", async () => {
  const fixture = stubLegacyServer({
    rows: [{capability:"people.manage",scope_unit_id:null},{capability:"payroll.prepare",scope_unit_id:null}],
    authorizer:({p_capability})=>p_capability==="payroll.prepare"
      ? {data:null,error:{code:"42501"}} : true,
  });
  const result = await readServerVerifiedLegacyGrants(fixture.supabase,"me","org");
  assert.deepEqual(result.grants,[]);
  assert.equal(result.verificationComplete,false);
});

test("failed legacy grant read cannot expose unauthorised Admin controls", async () => {
  const fixture = stubLegacyServer({readError:{code:"42501"}});
  const result = await readServerVerifiedLegacyGrants(fixture.supabase,"me","org");
  assert.deepEqual(result.grants,[]);
  assert.equal(result.verificationComplete,false);
  assert.equal(fixture.calls.length,0);
});
