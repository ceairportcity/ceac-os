import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/screens/TechnicalHelp.jsx", import.meta.url), "utf8");

test("a committed support insert is never presented as a failed submission when its follow-up read fails", () => {
  const insert = source.indexOf('await supabase.from("support_cases").insert(');
  const read = source.indexOf('await supabase.from("support_case_safe_status")', insert);
  const guard = source.indexOf("if (readFailure || !data)", read);
  const success = source.indexOf('setSuccess("Your request was recorded, but its reference could not be loaded.', guard);
  const reload = source.indexOf("setReloadCount((previous) => previous + 1)", guard);
  const catchBlock = source.indexOf("} catch (failure)", guard);
  assert.ok(insert >= 0 && read > insert && guard > read);
  assert.ok(success > guard && success < catchBlock);
  assert.ok(reload > guard && reload < catchBlock);
  assert.doesNotMatch(source.slice(guard, catchBlock), /throw readFailure|throw new Error/);
});

test("confirmed support cases are de-duplicated by id in the local request list", () => {
  assert.match(source, /previous\.filter\(\(item\) => item\.id !== data\.id\)/);
});
