import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=file=>readFileSync(file,"utf8");
const map=source("src/components/WorkforceStreetMap.jsx");
const hr=source("src/components/AdminWorkforceToday.jsx");
const people=source("src/screens/People.jsx");
const app=source("src/App.jsx");
const authority=source("src/screens/AdminAuthority.jsx");
const control=source("src/screens/ControlCenter.jsx");
const projects=source("src/screens/ManagerProjects.jsx");
test("owner-approved street view defaults on with provider privacy and hide control",()=>{
 assert.match(map,/consent\?visibleStreetTiles\(/);
 assert.match(map,/\[consent,setConsent\]=useState\(true\)/);
 assert.match(map,/setConsent\(false\)/);
 assert.doesNotMatch(map,/disabled=\{!clusters.length\}/);
 assert.match(map,/referrerPolicy="strict-origin-when-cross-origin"/);
 assert.match(map,/© OpenStreetMap contributors/);
 assert.match(map,/Staff identities and exact work-start records are not sent/);
 assert.doesNotMatch(map,/navigator\.geolocation/);
 assert.match(hr,/<WorkforceStreetMap key=\{officeScope\} clusters=\{clusters\} office=\{office\}/);
 assert.doesNotMatch(hr,/Relative coordinate plot/);
});
test("HR and Compliance use the same source-backed real map",()=>{
 const compliance=source("src/components/ComplianceOverview.jsx");
 assert.match(compliance,/<AdminWorkforceToday/);
 assert.match(compliance,/lat:session\.start_lat/);
 assert.match(map,/nextWorkforceClusterPersonId\(pin\.people,selectedId\)/);
});
test("People Access has one capability-gated employee-specific Authority link",()=>{
 assert.match(app,/onManagePermissions=\{canManageAuthority \? openAuthorityForPerson : null\}/);
 assert.match(people,/onManagePermissions\(person\.profile_id\)/);
 assert.match(people,/person\.profile_id && onManagePermissions/);
 assert.match(app,/initialProfileId=\{authorityFocusProfileId\}/);
 assert.match(authority,/useState\(initialProfileId \|\| me\.id\)/);
 assert.match(control,/label:"Manage permissions",onClick:\(\)=>go\("authority"\)/);
 assert.equal((control.match(/label:"Manage permissions"/g)||[]).length,1);
 assert.doesNotMatch(control,/label:"Authority"/);
});
test("project work register has no non-functional Board/Calendar view actions",()=>{
 assert.doesNotMatch(projects,/Board view is not connected/);
 assert.doesNotMatch(projects,/Calendar view is not connected/);
 assert.match(projects,/fpg-view-current/);
 assert.match(projects,/<ProjectIssueTable/);
 assert.match(projects,/<ProjectWorkDrawer/);
});
