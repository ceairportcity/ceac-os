import {test} from "node:test";
import assert from "node:assert/strict";
import {ceacNoticeTarget} from "../src/lib/notificationPriority.js";
import {readFileSync} from "node:fs";
const files={inbox:readFileSync("src/screens/Inbox.jsx","utf8"),view:readFileSync("src/screens/Notifications.jsx","utf8"),compliance:readFileSync("src/screens/Compliance.jsx","utf8"),app:readFileSync("src/App.jsx","utf8"),hook:readFileSync("src/lib/useCeacUnreadNotifications.js","utf8"),shell:readFileSync("src/experience-v2/shell/ShellV2.jsx","utf8")};
test("the shared Updates view routes to each authorised record",()=>{
 assert.match(files.inbox,/Notifications key=\{scope\}/);
 assert.match(files.compliance,/linkedCase\?"observations"/);
 assert.match(files.view,/mark_ceac_notification_read/);
 const id="11111111-1111-4111-8111-111111111111";
 assert.equal(ceacNoticeTarget({context_kind:"compliance_case",context_id:id}),"/?tab=compliance&case="+id);
 assert.equal(ceacNoticeTarget({context_kind:"memo",context_id:id}),"/?tab=messages&memo="+id);
 assert.equal(ceacNoticeTarget({context_kind:"work_item",context_id:id}),"/?tab=work&item="+id);
 assert.equal(ceacNoticeTarget({context_kind:"compliance_policy",context_id:id}),"/?tab=compliance&section=policies");
 assert.equal(ceacNoticeTarget({context_kind:"compliance_evidence",context_id:id}),"/?tab=compliance&section=evidence");
 assert.equal(ceacNoticeTarget({context_kind:"compliance_exception",context_id:id}),"/?tab=compliance&section=exceptions");
 assert.match(files.compliance,/availableSections.includes\(linkedSection\)/);
 assert.match(files.app,/isAdmin \|\| isStaff \|\| isUnitManager/);
});

test("Memos opens first without hiding Room or Updates journeys",()=>{
 assert.match(files.inbox,/get\("updates"\)==="1" \? "updates" : new URLSearchParams\(window.location.search\).get\("room"\) \? "rooms" : "memos"/);
 assert.ok(files.inbox.indexOf('aria-label="Memos" aria-current=') < files.inbox.indexOf('aria-label="Rooms" aria-current='));
 assert.match(files.inbox,/aria-label=\{notifications\?\.count/);
 assert.match(files.hook,/setAppBadge/);
 assert.match(files.shell,/UnreadBadge count=\{notificationCounts\?\.count\}/);
 assert.match(files.app,/onOpenUpdates=/);
 assert.match(files.inbox,/ceac-notification-badge/);
 assert.match(files.inbox,/> Rooms \{notifications\?\.room/);
 assert.match(files.inbox,/> Memos \{notifications\?\.memo/);
});

test("notification read receipt failures do not block opening authorised Work or Memo",()=>{
  assert.match(files.view,/A temporary read-receipt failure must not block opening the source/);
  assert.match(files.view,/window.location.assign\(row.url/);
  assert.doesNotMatch(files.view,/if\(result.error\)\{setBusy\("+"""+"\);setError\("This update could not be marked as read\. Retry\."\);return;/);
});
