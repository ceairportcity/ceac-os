/** Source-backed Administration daily session overview; no attendance inference. */
const validCoordinate=(lat,lng)=>lat!==null&&lat!==undefined&&lng!==null&&lng!==undefined
 && Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))
 && Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180;

export function adminWorkforceToday(roster,sessions){
 if(!Array.isArray(roster)||!Array.isArray(sessions))
  throw new Error("Daily workforce evidence is incomplete.");
 const linked=new Map();
 const people=roster.filter(person=>person&&person.id).map(person=>{
  if(person.profile_id) linked.set(person.profile_id,person.id);
  return {id:person.id,profileId:person.profile_id||null,name:person.full_name||person.preferred_name||"Employee",
   unit:(person.units||[]).map(unit=>typeof unit==="string"?unit:unit.name||unit.unit_name).filter(Boolean).join(", ")||"Unit not recorded",
   linked:!!person.profile_id,firstStart:null,sessionCount:0,open:false,place:null,latitude:null,longitude:null,
   locationCapturedAt:null,accuracyM:null};
 });
 const byId=new Map(people.map(person=>[person.id,person]));
 const byStart=[...sessions].filter(session=>session&&session.profile_id&&session.started_at)
  .sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||String(a.id||"").localeCompare(String(b.id||"")));
 for(const session of byStart){
  let row=byId.get(linked.get(session.profile_id));
  if(!row){
   // A real session can exist while the roster linkage is temporarily unresolved.
   row={id:"profile:"+session.profile_id,profileId:session.profile_id,name:"Employee record unavailable",
    unit:"Unit not recorded",linked:true,firstStart:null,sessionCount:0,open:false,place:null,
    latitude:null,longitude:null,locationCapturedAt:null,accuracyM:null};
   byId.set(row.id,row);
  }
  row.sessionCount++;
  if(!session.ended_at) row.open=true;
  if(row.firstStart!==null) continue;
  row.firstStart=session.started_at;
  row.place=session.place||null;
  if(validCoordinate(session.lat,session.lng)){
   row.latitude=Number(session.lat);row.longitude=Number(session.lng);
   row.locationCapturedAt=session.location_captured_at||null;
   row.accuracyM=session.location_accuracy_m==null?null:Number(session.location_accuracy_m);
  }
 }
 return [...byId.values()].sort((a,b)=>Number(Boolean(b.firstStart))-Number(Boolean(a.firstStart))
  ||(a.firstStart&&b.firstStart?Date.parse(a.firstStart)-Date.parse(b.firstStart):0)
  ||a.name.localeCompare(b.name));
}

/** Only the first recorded session's start coordinates are plotted. */
export function clusterWorkStartLocations(rows){
 const clusters=new Map();
 for(const row of rows){
  if(!row.firstStart||!validCoordinate(row.latitude,row.longitude)) continue;
  const key=Number(row.latitude).toFixed(5)+":"+Number(row.longitude).toFixed(5);
  if(!clusters.has(key)) clusters.set(key,{key,lat:row.latitude,lng:row.longitude,people:[]});
  clusters.get(key).people.push(row);
 }
 return [...clusters.values()];
}
