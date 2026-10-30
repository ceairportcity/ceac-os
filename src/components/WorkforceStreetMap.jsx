import {useEffect,useMemo,useRef,useState} from 'react';
import {staffInitials} from '../lib/workforcePresentation';
import {googleMapsConfigured,loadGoogleMaps,googleMapPoint,googleMapFailure,googleMapsFallbackUrl} from '../lib/googleMaps';
import './WorkforceStreetMap.css';
const EMPTY=[];

/** Shared Google road map for HR, Compliance, Executive and duty venues. */
export default function WorkforceStreetMap({clusters=EMPTY,office=null,selectedId,onSelect,selectedContent,focusLocation=null,onChooseLocation}){
 const choosing=typeof onChooseLocation==='function';
 const configured=googleMapsConfigured||Boolean(window.google?.maps?.Map);
 const frame=useRef(null),map=useRef(null),maps=useRef(null),selectedMarker=useRef(null);
 const latest=useRef({selectedId,onSelect});latest.current={selectedId,onSelect};
 const [consent,setConsent]=useState(true),[state,setState]=useState('loading'),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false);
 const [issue,setIssue]=useState(null);
 const points=useMemo(()=>focusLocation?[focusLocation]:office?[...clusters,office]:clusters,[clusters,office,focusLocation]);
 function fit(){
  if(!map.current||!maps.current||!points.length)return;
  const bounds=new maps.current.LatLngBounds();points.forEach(p=>bounds.extend({lat:p.lat,lng:p.lng}));
  map.current.fitBounds(bounds,55);
  maps.current.event.addListenerOnce(map.current,'idle',()=>{if(map.current?.getZoom()>16)map.current.setZoom(16);});
 }
 useEffect(()=>{
  let alive=true,timer,policyBlocked=false,fatal=false;const listeners=[];
  setReady(false);setState('loading');setIssue(null);
  if(!consent)return;
  const failed=error=>{if(alive){clearTimeout(timer);const next=googleMapFailure(policyBlocked?{code:'MAP-POLICY'}:error?.detail||error);fatal=['MAP-AUTH','MAP-POLICY','MAP-INITIALISE'].includes(next.code);setIssue(next);setState('error');}};
  const blocked=event=>{
   if(event.disposition!=='enforce')return;
   try{const host=new URL(event.blockedURI).hostname;if(host==='maps.googleapis.com'||host==='maps.gstatic.com'||/^(khms\d*|mt\d*)\.googleapis\.com$/.test(host)){policyBlocked=true;failed({code:'MAP-POLICY'});}}catch{/* Ignore non-URL and unrelated policy reports. */}
  };
  window.addEventListener('ceac-google-map-error',failed);
  document.addEventListener('securitypolicyviolation',blocked);
  loadGoogleMaps().then(api=>{
   if(!alive||!frame.current)return;
   maps.current=api;
   map.current=new api.Map(frame.current,{
    center:points[0]?{lat:points[0].lat,lng:points[0].lng}:{lat:5.6037,lng:-.187},zoom:12,
    renderingType:'RASTER',streetViewControl:false,mapTypeControl:false,fullscreenControl:false,
    gestureHandling:'cooperative',clickableIcons:false,
    styles:[{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]}],
   });
   listeners.push(api.event.addListenerOnce(map.current,'tilesloaded',()=>{if(alive&&!fatal){clearTimeout(timer);setIssue(null);setState('ready');}}));
   timer=setTimeout(()=>failed({code:'MAP-TILES-TIMEOUT'}),20000);setReady(true);
  }).catch(failed);
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('ceac-google-map-error',failed);document.removeEventListener('securitypolicyviolation',blocked);listeners.forEach(l=>l.remove());if(map.current)maps.current?.event.clearInstanceListeners(map.current);map.current=null;};
 },[consent,attempt]);
 useEffect(()=>{
  if(!ready||!map.current)return;
  fit();const overlays=[];
  if(!choosing){
   for(const cluster of clusters){
    // Keep authentic recorded coordinates: only the screen-space marker positions
    // are separated to make individuals at one work-start point identifiable.
    const group=cluster.people,visible=group.slice(0,12),total=group.length;
    visible.forEach((person,index)=>{
     const node=document.createElement('button');node.type='button';
     node.className='ceac-street-map-marker ceac-person-marker'+(person.id===latest.current.selectedId?' is-selected':'');
     node.dataset.workforceCluster=cluster.key;node.dataset.workforcePerson=person.id;
     node.setAttribute('aria-label','View recorded work start for '+person.name);
     node.setAttribute('aria-pressed',String(person.id===latest.current.selectedId));
     node.title=person.name+' · recorded work start';
     const radius=total===1?0:total<=2?29:total<=6?36:48;
     const angle=-Math.PI/2+index*2*Math.PI/Math.min(total,12);
     node.style.setProperty('--ceac-pin-x',Math.round(radius*Math.cos(angle))+'px');
     node.style.setProperty('--ceac-pin-y',Math.round(radius*Math.sin(angle))+'px');
     const avatar=document.createElement('span');avatar.className='ceac-map-avatar';
     avatar.textContent=staffInitials(person.name);node.append(avatar);
     node.onclick=()=>{selectedMarker.current=node;latest.current.onSelect?.(person.id);};
     overlays.push(googleMapPoint(maps.current,map.current,cluster,node));
    });
    if(total>12){
     const hidden=group.slice(12),node=document.createElement('button');node.type='button';
     node.className='ceac-street-map-marker ceac-person-marker ceac-map-extra';
     node.dataset.workforceCluster=cluster.key;
     node.setAttribute('aria-label',hidden.length+' more staff at this recorded location; select to view');
     node.style.setProperty('--ceac-pin-x','0px');node.style.setProperty('--ceac-pin-y','65px');
     const badge=document.createElement('span');badge.className='ceac-map-avatar';
     badge.textContent='+'+hidden.length;node.append(badge);
     node.onclick=()=>{const index=hidden.findIndex(p=>p.id===latest.current.selectedId);latest.current.onSelect?.(hidden[(index+1)%hidden.length]?.id);};
     overlays.push(googleMapPoint(maps.current,map.current,cluster,node));
    }
   }
   if(office){
    const node=document.createElement('span');node.className='ceac-street-map-marker ceac-office-reference';
    node.setAttribute('role','img');node.setAttribute('aria-label','CEAC Church Office · Saved office reference');
    node.title=office.name+' · Reference only, not attendance proof';
    const icon=document.createElement('span');icon.className='ceac-office-symbol';icon.setAttribute('aria-hidden','true');icon.textContent='⌂';
    const label=document.createElement('span');label.textContent='CEAC Church Office';label.className='ceac-office-label';
    node.append(icon,label);overlays.push(googleMapPoint(maps.current,map.current,office,node));
   }
  }
  return()=>overlays.forEach(o=>o.setMap(null));
 },[ready,clusters,office,focusLocation,choosing]);
 // Changing a selection must not reconstruct the map or reset the viewport.
 useEffect(()=>{frame.current?.querySelectorAll('[data-workforce-person]').forEach(node=>{const chosen=node.dataset.workforcePerson===selectedId;node.classList.toggle('is-selected',chosen);node.setAttribute('aria-pressed',String(chosen));});},[selectedId,clusters]);
 const officePeople=clusters.flatMap(c=>c.people).filter(p=>p.place==='office');
 // When Google rejects the SDK download on a user's device, retain a genuine
 // Google road map in read-only views via its independent iframe endpoint.
 // Duty-venue picking still requires the full SDK to return precise coordinates.
 const fallbackNeeded=!choosing&&configured&&state==='error'&&['MAP-DOWNLOAD','MAP-SDK-TIMEOUT','MAP-POLICY','MAP-TILES-TIMEOUT'].includes(issue?.code);
 const focusedCluster=clusters.find(c=>c.people.some(p=>p.id===selectedId));
 const fallbackStaff=clusters.flatMap(c=>c.people);
 const focusedPerson=fallbackStaff.find(person=>person.id===selectedId);
 const fallbackUrl=fallbackNeeded?googleMapsFallbackUrl(focusedCluster||office||clusters[0]||{lat:5.6037,lng:-0.187}):null;
 const fallbackActive=Boolean(fallbackUrl);
 return <section className="ceac-street-map" aria-label={choosing?'Choose duty venue on street map':'Recorded workforce work-start street map'}>
  <div className="ceac-street-map-viewport">
   {consent&&<div ref={frame} className="ceac-google-map-canvas" aria-label="Google Maps road map" hidden={fallbackActive}/>}
   {consent&&fallbackActive&&<iframe className="ceac-google-fallback-frame" title="Google Maps alternative road map" src={fallbackUrl} loading="eager" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>}
   {choosing&&consent&&ready&&<span className="ceac-google-centre" aria-hidden="true">+</span>}
   {!consent?<div className="ceac-street-map-optin"><strong>Google Maps is hidden</strong><button className="btn btn-sm" type="button" onClick={()=>setConsent(true)}>Show Google Maps</button></div>:state!=='ready'&&!fallbackActive?<div className="ceac-google-map-state" role="status">
    <strong>{state==='loading'?'Loading Google Maps…':configured?'Google Maps is unavailable':'Google Maps setup required'}</strong>
    {state==='error'&&<><span>{issue?.message} Employee records remain available below.</span><small>Map check: {issue?.code}</small></>}
    {state==='error'&&configured&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>issue?.code==='MAP-AUTH'?window.location.reload():setAttempt(n=>n+1)}>{issue?.code==='MAP-AUTH'?'Reload map configuration':'Retry Google Maps'}</button>}
   </div>:null}
  </div>
  {consent&&fallbackActive&&<div className="ceac-google-recovery" role="status"><span>{focusedPerson?'Showing '+focusedPerson.name+'’s recorded start location.':'Google road view is available. Choose a staff member below to focus their recorded start location.'} Staff markers require the interactive map.</span>{office&&<small>CEAC Church Office · saved reference</small>}<small>Map check: {issue?.code}</small><div><button className="btn btn-ghost btn-sm" type="button" onClick={()=>setAttempt(n=>n+1)}>Retry interactive map</button> <a className="btn btn-ghost btn-sm" href={'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:(focusedCluster||office||clusters[0]||{lat:5.6037,lng:-0.187}).lat+','+(focusedCluster||office||clusters[0]||{lat:5.6037,lng:-0.187}).lng})} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></div></div>}
  {consent&&fallbackActive&&fallbackStaff.length>0&&<div className="ceac-google-fallback-points" aria-label="Recorded staff map locations">{fallbackStaff.map(person=><button type="button" key={person.id} className="btn btn-ghost btn-sm" aria-pressed={person.id===selectedId} onClick={()=>onSelect?.(person.id)} aria-label={'View recorded location for '+person.name}><span className="ceac-map-avatar" aria-hidden="true">{staffInitials(person.name)}</span><span>{person.name}</span></button>)}</div>}
  {consent&&<div className="ceac-street-map-after"><span>Recorded starts · not live tracking</span><div><button className="btn btn-ghost btn-sm" disabled={!ready||state!=='ready'} onClick={fit}>Fit staff start locations</button> <button className="btn btn-ghost btn-sm" onClick={()=>setConsent(false)}>Hide street map</button></div></div>}
  {!choosing&&!clusters.length&&<p className="screen-note">No recorded start GPS for these filters.</p>}
  {!choosing&&officePeople.length>0&&<div className="workstart-summary" aria-label="Recorded office starts"><strong>Office starts</strong>{officePeople.map(p=><button type="button" key={p.id} aria-pressed={p.id===selectedId} onClick={e=>{selectedMarker.current=e.currentTarget;onSelect?.(p.id);}}>{p.name}</button>)}</div>}
  {clusters.filter(c=>c.people.length>1&&c.people.some(p=>p.id===selectedId)).map(c=><div className="workstart-summary" aria-label="People at this recorded location" key={c.key}>{c.people.map(p=><button type="button" key={p.id} aria-pressed={p.id===selectedId} onClick={()=>onSelect?.(p.id)}>{p.name}</button>)}</div>)}
  {selectedContent&&<section className="ceac-google-selected" aria-label="Selected work start"><button className="btn btn-ghost btn-sm" onClick={()=>{onSelect?.(null);selectedMarker.current?.focus();}}>Close selected work start</button>{selectedContent}</section>}
  {consent&&<p className="screen-note">Google Maps receives the viewed map area and device/network information to render the map. Employee names are not included in map requests. The office marker is a saved reference, not attendance proof.</p>}
  {choosing&&consent&&<button className="btn btn-sm" disabled={state!=='ready'} onClick={()=>{const p=map.current?.getCenter();if(p)onChooseLocation({lat:p.lat(),lng:p.lng()});}}>Use map centre for this venue</button>}
 </section>;
}
