import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDependencyAudit } from "../scripts/ci/audit-dependencies.mjs";

const advisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const picomatch = { severity:"high", dev:true, via:[{ url:advisory, severity:"high" }] };
const via = ref => ({severity:"high",dev:true,via:[ref]});
function knownIssue() {
  return { vulnerabilities: {picomatch, fdir:via("picomatch"), tinyglobby:via("fdir"),
    vite:via("picomatch"), "@vitejs/plugin-react":via("vite")} };
}

test("the one temporary build-only advisory is accepted only before its expiry", () => {
  assert.equal(evaluateDependencyAudit(knownIssue(), Date.parse("2026-11-17")).ok, true);
  assert.equal(evaluateDependencyAudit(knownIssue(), Date.parse("2026-11-17")).exception, true);
  assert.equal(evaluateDependencyAudit(knownIssue(), Date.parse("2026-12-17")).ok, false);
  assert.equal(evaluateDependencyAudit({vulnerabilities:{}}, Date.parse("2027-01-01")).ok, true);
});
test("new advisories, prod exposure, critical findings and audit errors always block", () => {
  assert.equal(evaluateDependencyAudit({error:"npm outage"}).ok,false);
  const unexpected=knownIssue();unexpected.vulnerabilities.react={severity:"high",dev:false,via:["picomatch"]};
  assert.equal(evaluateDependencyAudit(unexpected).ok,false);
  const prod=knownIssue();prod.vulnerabilities.picomatch={...picomatch,dev:false};
  assert.equal(evaluateDependencyAudit(prod).ok,false);
  const second=knownIssue();second.vulnerabilities.picomatch={...picomatch,via:[...picomatch.via,{url:"https://github.com/advisories/OTHER",severity:"high"}]};
  assert.equal(evaluateDependencyAudit(second).ok,false);
  const critical=knownIssue();critical.vulnerabilities.picomatch={...picomatch,severity:"critical"};
  assert.equal(evaluateDependencyAudit(critical).ok,false);
});

test("checked-in dependency types, not npm metapackage labels, determine actual dev exposure", () => {
  const audit=knownIssue();
  audit.vulnerabilities["@vitejs/plugin-react"]={...audit.vulnerabilities["@vitejs/plugin-react"],dev:false};
  const packages=Object.fromEntries(Object.keys(audit.vulnerabilities).map(name=>["node_modules/"+name,{dev:true}]));
  assert.equal(evaluateDependencyAudit(audit,Date.parse("2026-11-17"),packages).ok,true);
  packages["node_modules/@vitejs/plugin-react"].dev=false;
  assert.equal(evaluateDependencyAudit(audit,Date.parse("2026-11-17"),packages).ok,false);
});
