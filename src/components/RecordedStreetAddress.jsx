import {useEffect,useState} from 'react';

// Address verification is requested for one selected work-start only, not the
// entire roster. This avoids bulk billing, third-party sharing or guessed roads.
export default function RecordedStreetAddress({latitude,longitude,onResolved}){
 const [status,setStatus]=useState('idle'),[address,setAddress]=useState('');
 useEffect(()=>{setStatus('idle');setAddress('');},[latitude,longitude]);
 const lat=Number(latitude),lng=Number(longitude);
 const valid=latitude!=null&&longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 async function resolve(){
  if(!valid)return;
  const maps=window.google?.maps;
  if(typeof maps?.Geocoder!=='function'){
   setStatus('sdk-unavailable');
   return;
  }
  setStatus('loading');
  try{
   const geo=new maps.Geocoder();
   const response=await geo.geocode({location:{lat,lng}});
   const rows=response?.results||[];
   const result=rows.find(r=>r.types?.includes('street_address'))||rows.find(r=>r.types?.includes('route'))||rows[0];
   const road=result?.address_components?.find(p=>p.types?.includes('route'))?.long_name;
   const district=result?.address_components?.find(p=>p.types?.includes('sublocality')||p.types?.includes('neighborhood'))?.long_name;
   const city=result?.address_components?.find(p=>p.types?.includes('locality'))?.long_name;
   const parts=[road,district,city].filter((v,i,a)=>v&&a.indexOf(v)===i);
   if(!road){setStatus('unresolved');return;}
   const resolved=parts.join(', ');
   setAddress(resolved);setStatus('ready');onResolved?.(resolved);
  }catch{setStatus('unresolved');}
 }
 if(!valid)return <span>Street address unavailable: no recorded location</span>;
 return <div className="workstart-person-detail" aria-label="Recorded street address">
  {status==='ready'?<span><strong>Recorded street:</strong> {address} (approximate)</span>
   :<span>{status==='loading'?'Checking the recorded street…':status==='unresolved'?'Google could not verify a street name here.':status==='sdk-unavailable'?'Street lookup requires the interactive Google map.':'Street name not yet verified'}</span>}
  {status!=='ready'&&<button type="button" className="btn btn-ghost btn-sm" disabled={status==='loading'} onClick={resolve}>Look up recorded street</button>}
  <small>Google's Geocoding service may require separate API access or incur usage charges. This lookup runs only when selected.</small>
 </div>;
}
