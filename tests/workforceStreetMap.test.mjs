import test from "node:test";
import assert from "node:assert/strict";
import {fitWorkforceMap,pointCoordinates,visibleStreetTiles,worldPoint,workforcePinPosition} from "../src/lib/workforceStreetMap.js";

test("real Web-Mercator geographically positions GPS recorded in Ghana",()=>{
 const p=worldPoint(5.6037,-0.1870,13);
 const recovered=pointCoordinates(p.x,p.y,13);
 assert.ok(Math.abs(recovered.lat-5.6037)<0.000001);
 assert.ok(Math.abs(recovered.lng+0.1870)<0.000001);
});
test("work-start pins retain their actual geography, not artificial relative spread",()=>{
 const rows=[{key:"a",lat:5.6037,lng:-0.1870},{key:"b",lat:5.6037,lng:-0.1770}];
 const view=fitWorkforceMap(rows,600,340);
 const a=workforcePinPosition(rows[0],view,view.zoom,600,340);
 const b=workforcePinPosition(rows[1],view,view.zoom,600,340);
 assert.ok(a.x<b.x,"The eastern point must appear to the east.");
 assert.ok(a.x>=0&&b.x<=600&&a.y>=0&&b.y<=340);
});
test("zoomed tiled streets have only bounded x/y and provider gets no staff identity",()=>{
 const tiles=visibleStreetTiles({lat:5.6037,lng:-0.1870},14,540,340);
 assert.ok(tiles.length>0&&tiles.length<=16);
 for(const tile of tiles){
  const match=tile.url.match(/^https:\/\/tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)\.png$/);
  assert.ok(match,tile.url);
  assert.equal(+match[1],14);
  assert.ok(+match[2]<2**14&&+match[3]<2**14);
  assert.doesNotMatch(tile.url,/profile|employee|org|lat|lng|email|work_session/i);
 }
});
test("empty map does not invent any employee location",()=>{
 const view=fitWorkforceMap([],480,310);
 assert.equal(view.zoom,11);
 assert.deepEqual(visibleStreetTiles(view,view.zoom,480,310).length>0,true);
});
test("invalid coordinate values and impossible zoom are rejected",()=>{
 assert.throws(()=>worldPoint(91,0,12),/Invalid geographic coordinate/);
 assert.throws(()=>worldPoint(5.6,181,12),/Invalid geographic coordinate/);
 assert.throws(()=>worldPoint(null,0,12),/Invalid geographic coordinate/);
 assert.throws(()=>worldPoint(5.6,0,35),/Invalid geographic coordinate/);
});
