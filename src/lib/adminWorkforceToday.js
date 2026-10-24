/** Source-backed Administration daily session overview; no attendance inference. */
const validCoordinate=(lat,lng)=>lat!==null&&lat!==undefined&&lng!==null&&lng!==undefined
 && Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))
 && Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180;

export function adminWorkforceToday(roster,sessions,operationalProfiles=[],startChoice="latest"){
 if(!Array.isArray(roster)||!Array.isArray(sessions)||!Array.isArray(operationalProfiles))
  throw new Error("Daily workforce evidence is incomplete.");
 const linked=new Map();
 const people=roster.filter(person=>person&&person.id).map(person=>{
  if(person.profile_id) linked.set(person.profile_id,person.id);
  const unitNames=(Array.isArray(person.units)?person.units:[]).map(unit=>typeof unit==="string"?unit:unit?.name||unit?.unit_name).filter(Boolean);
  if(!unitNames.length&&person.unit_name)unitNames.push(person.unit_name);
  return {id:person.id,profileId:person.profile_id||null,name:person.full_name||person.preferred_name||"Employee",
   unitNames,unit:unitNames.join(", ")||"Unit not recorded",
   linked:!!person.profile_id,firstStart:null,sessionCount:0,open:false,place:null,latitude:null,longitude:null,
   locationCapturedAt:null,accuracyM:null,mapStart:null,startHistory:[]};
 });
 const byId=new Map(people.map(person=>[person.id,person]));
 const accountByProfile=new Map(operationalProfiles.filter(p=>p?.profile_id&&p?.full_name).map(p=>[p.profile_id,p]));
 const byStart=[...sessions].filter(session=>session&&session.profile_id&&session.started_at&&Number.isFinite(Date.parse(session.started_at)))
  .sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||String(a.id||"").localeCompare(String(b.id||"")));
 for(const session of byStart){
  let row=byId.get(linked.get(session.profile_id)) || byId.get("profile:"+session.profile_id);
  if(!row){
   // A real session can exist while the roster linkage is temporarily unresolved.
   const account=accountByProfile.get(session.profile_id);
   row={id:"profile:"+session.profile_id,profileId:session.profile_id,name:account?.full_name||"Employee record unavailable",
    unitNames:account?.unit_name?[account.unit_name]:[],unit:account?.unit_name||"Unit not recorded",linked:false,firstStart:null,sessionCount:0,open:false,place:null,
    latitude:null,longitude:null,locationCapturedAt:null,accuracyM:null,mapStart:null,startHistory:[]};
   byId.set(row.id,row);
  }
  row.sessionCount++;
  if(!session.ended_at) row.open=true;
  row.startHistory.push({id:session.id,started_at:session.started_at,ended_at:session.ended_at,place:session.place||null});
  if(row.firstStart===null) row.firstStart=session.started_at;
  if(startChoice==="first" && row.mapStart!==null) continue;
  row.mapStart=session.started_at;
  row.mapOpen=!session.ended_at;
  row.latitude=null;row.longitude=null;row.locationCapturedAt=null;row.accuracyM=null;
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

/** Plot the chosen recorded work start; never substitute an earlier valid GPS for a missing latest capture. */
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
