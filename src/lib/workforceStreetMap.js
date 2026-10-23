/** Web-Mercator street-map geometry. Does not read user/device location or transmit staff data. */
const LIMIT=85.05112878;
export const MAP_TILE_SIZE=256;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const finite=(x)=>typeof x==="number"&&Number.isFinite(x);
export function worldPoint(lat,lng,zoom) {
 if(!finite(lat)||!finite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||!Number.isInteger(zoom)||zoom<0||zoom>18)
  throw new Error("Invalid geographic coordinate.");
 const scale=MAP_TILE_SIZE*2**zoom;
 const latitude=clamp(lat,-LIMIT,LIMIT)*Math.PI/180;
 return {x:(lng+180)/360*scale,y:(1-Math.asinh(Math.tan(latitude))/Math.PI)/2*scale};
}
export function pointCoordinates(x,y,zoom) {
 const scale=MAP_TILE_SIZE*2**zoom;
 const latitude=Math.atan(Math.sinh(Math.PI*(1-2*clamp(y,0,scale)/scale)))*180/Math.PI;
 const longitude=((x/scale*360)%360+360)%360-180;
 return {lat:latitude,lng:longitude};
}
export function fitWorkforceMap(clusters,width=600,height=320) {
 if(!Array.isArray(clusters)||!clusters.length) return {lat:5.6037,lng:-0.1870,zoom:11};
 const values=clusters.filter(c=>finite(c?.lat)&&finite(c?.lng)&&Math.abs(c.lat)<=90&&Math.abs(c.lng)<=180);
 if(!values.length)return {lat:5.6037,lng:-0.1870,zoom:11};
 const sw=Math.max(180,Number(width)||600),sh=Math.max(200,Number(height)||320);
 for(let zoom=16;zoom>=2;zoom--){
  const pts=values.map(p=>worldPoint(p.lat,p.lng,zoom));
  const xSpan=Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x));
  const ySpan=Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));
  if(xSpan<sw-96&&ySpan<sh-110){
   const middle=pointCoordinates((Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.x)))/2,
    (Math.min(...pts.map(p=>p.y))+Math.max(...pts.map(p=>p.y)))/2,zoom);
   return {...middle,zoom};
  }
 }
 const pts=values.map(p=>worldPoint(p.lat,p.lng,2));
 return {...pointCoordinates((Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.x)))/2,
  (Math.min(...pts.map(p=>p.y))+Math.max(...pts.map(p=>p.y)))/2,2),zoom:2};
}
export function visibleStreetTiles(center,zoom,width,height) {
 const point=worldPoint(center.lat,center.lng,zoom),max=2**zoom;
 const origin={x:point.x-width/2,y:point.y-height/2};
 const tiles=[];
 const x0=Math.floor(origin.x/MAP_TILE_SIZE),x1=Math.floor((origin.x+width)/MAP_TILE_SIZE);
 const y0=Math.floor(origin.y/MAP_TILE_SIZE),y1=Math.floor((origin.y+height)/MAP_TILE_SIZE);
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
  if(y<0||y>=max)continue;
  const tileX=((x%max)+max)%max;
  tiles.push({key:`${zoom}:${x}:${y}`,x:MAP_TILE_SIZE*x-origin.x,y:MAP_TILE_SIZE*y-origin.y,
   url:`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`});
 }
 return tiles;
}
export function workforcePinPosition(cluster,center,zoom,width,height) {
 const point=worldPoint(cluster.lat,cluster.lng,zoom),middle=worldPoint(center.lat,center.lng,zoom);
 const world=MAP_TILE_SIZE*2**zoom;
 const wrappedX=((point.x-middle.x+world/2)%world+world)%world-world/2;
 return {x:Math.round(width/2+wrappedX),y:Math.round(height/2+point.y-middle.y)};
}

/** Repeated activation of a shared-coordinate marker reaches every real
 * employee at that start point, without exposing identities to tile providers.
 */
export function nextWorkforceClusterPersonId(people,selectedId) {
 if(!Array.isArray(people)||!people.length)return null;
 const current=people.findIndex(person=>person?.id===selectedId);
 return people[(current+1)%people.length]?.id||null;
}
