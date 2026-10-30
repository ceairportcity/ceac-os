/** Present existing, role-scoped attendance without inferring a live location. */
export function staffInitials(name){
 const words=String(name||'').trim().split(/\s+/).filter(Boolean);
 if(!words.length)return '—';
 return (words.length===1?words[0].slice(0,2):words[0][0]+words[words.length-1][0]).toUpperCase();
}
export function attendanceSnapshot(people=[]){
 const started=people.filter(p=>Boolean(p?.firstStart));
 return {
  started:started.length,
  office:started.filter(p=>p.place==='office').length,
  offsite:started.filter(p=>p.place==='elsewhere').length,
  notStarted:people.length-started.length
 };
}
export function recordedPlace(person,office,verifiedStreet=null){
 if(verifiedStreet&&person?.firstStart)return {label:'Recorded street (approximate)',address:verifiedStreet};
 if(!person?.firstStart)return {label:'No work start recorded',address:'No recorded start location'};
 if(person.place==='office')return {label:'Office selected',address:office?.name||'CEAC Church Office'};
 if(person.place==='elsewhere')return {label:'Off-site selected',address:'Street address not yet verified'};
 return {label:'Place not specified',address:'Street address not yet verified'};
}
export function recordedMapUrl(person){
 const lat=Number(person?.latitude),lng=Number(person?.longitude);
 if(person?.latitude==null||person?.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:lat+','+lng});
}
