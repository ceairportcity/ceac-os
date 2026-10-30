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
 assert.match(map,/loadGoogleMaps\(\)/);
 assert.match(map,/\[consent,setConsent\]=useState\(true\)/);
 assert.match(map,/setConsent\(false\)/);
 assert.doesNotMatch(map,/disabled=\{!clusters.length\}/);
 assert.match(source("src/lib/googleMaps.js"),/referrerPolicy='strict-origin-when-cross-origin'/);
 assert.match(map,/Google Maps receives the viewed map area/);
 assert.match(map,/Employee names are not included in map requests/);
 assert.doesNotMatch(map,/navigator\.geolocation/);
 assert.match(hr,/<WorkforceStreetMap key=\{officeScope\} clusters=\{clusters\} office=\{office\}/);
 assert.doesNotMatch(hr,/Relative coordinate plot/);
});
test("HR and Compliance use the same source-backed real map",()=>{
 const compliance=source("src/components/ComplianceOverview.jsx");
 assert.match(compliance,/<AdminWorkforceToday/);
 assert.match(compliance,/lat:session\.start_lat/);
 // Individual on-map pins now select each person directly at shared coordinates.
 assert.match(map,/node\.dataset\.workforcePerson=person\.id/);
 assert.match(map,/latest\.current\.onSelect\?\.\(person\.id\)/);
 // The Google iframe fallback now lists each staff member individually.
 assert.match(map,/fallbackStaff\.map\(person=>/);
 assert.match(map,/aria-label=\{'View recorded location for '\+person\.name\}/);
 assert.match(map,/onSelect\?\.\(person\.id\)/);
});
test("People Access has one capability-gated employee-specific Authority link",()=>{
 assert.match(app,/onManagePermissions=\{canManageAuthority \? openAuthorityForPerson : null\}/);
 assert.match(people,/onManagePermissions\(person\.profile_id\)/);
 assert.match(people,/person\.profile_id && onManagePermissions/);
 assert.match(app,/initialProfileId=\{authorityFocusProfileId\}/);
 assert.match(authority,/useState\(initialProfileId \|\| me\.id\)/);
 assert.match(control,/title:"Access permissions"[^\n]*go\("authority"\)/);
 assert.equal((control.match(/title:"Access permissions"/g)||[]).length,1);
 assert.doesNotMatch(control,/label:"Authority"/);
});
test("project work register has no non-functional Board/Calendar view actions",()=>{
 assert.doesNotMatch(projects,/Board view is not connected/);
 assert.doesNotMatch(projects,/Calendar view is not connected/);
 assert.match(projects,/fpg-view-current/);
 assert.match(projects,/<ProjectIssueTable/);
 assert.match(projects,/<ProjectWorkDrawer/);
});
