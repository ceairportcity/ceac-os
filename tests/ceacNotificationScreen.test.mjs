import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const files={inbox:readFileSync("src/screens/Inbox.jsx","utf8"),view:readFileSync("src/screens/Notifications.jsx","utf8"),compliance:readFileSync("src/screens/Compliance.jsx","utf8"),app:readFileSync("src/App.jsx","utf8")};
test("the shared Updates view routes to each authorised record",()=>{
 assert.match(files.inbox,/Notifications key=\{scope\}/);
 assert.match(files.compliance,/linkedCase\?"observations"/);
 assert.match(files.view,/mark_ceac_notification_read/);
 assert.match(files.view,/context_kind==="compliance_case"/);
 assert.match(files.view,/context_kind==="memo"/);
 assert.match(files.view,/context_kind==="work_item"/);
 assert.match(files.view,/context_kind==="compliance_policy"/);
 assert.match(files.view,/context_kind==="compliance_evidence"/);
 assert.match(files.view,/context_kind==="compliance_exception"/);
 assert.match(files.compliance,/availableSections.includes\(linkedSection\)/);
 assert.match(files.app,/isAdmin \|\| isStaff \|\| isUnitManager/);
});

test("existing room and Memo journeys remain the initial Messages experience",()=>{
 assert.match(files.inbox,/get\("updates"\)==="1" \? "updates" : "rooms"/);
 assert.match(files.inbox,/aria-label=\{notifications\?\.count/);
 assert.match(files.inbox,/setAppBadge/);
 assert.match(files.inbox,/ceac-notification-badge/);
 assert.match(files.inbox,/> Rooms<\/button>/);
 assert.match(files.inbox,/> Memos \{notifications\?\.memo/);
});
