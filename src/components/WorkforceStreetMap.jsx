import {useEffect,useMemo,useRef,useState} from 'react';
import {nextWorkforceClusterPersonId} from '../lib/workforceStreetMap';
import {googleMapsConfigured,loadGoogleMaps,googleMapPoint} from '../lib/googleMaps';
import './WorkforceStreetMap.css';
const EMPTY=[];

/** Shared Google road map for HR, Compliance, Executive and duty venues. */
export default function WorkforceStreetMap({clusters=EMPTY,office=null,selectedId,onSelect,selectedContent,focusLocation=null,onChooseLocation}){
 const choosing=typeof onChooseLocation==='function';
 const configured=googleMapsConfigured||Boolean(window.google?.maps?.Map);
 const frame=useRef(null),map=useRef(null),maps=useRef(null),selectedMarker=useRef(null);
 const latest=useRef({selectedId,onSelect});latest.current={selectedId,onSelect};
 const [consent,setConsent]=useState(true),[state,setState]=useState('loading'),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false);
 const points=useMemo(()=>focusLocation?[focusLocation]:office?[...clusters,office]:clusters,[clusters,office,focusLocation]);
 function fit(){
  if(!map.current||!maps.current||!points.length)return;
  const bounds=new maps.current.LatLngBounds();points.forEach(p=>bounds.extend({lat:p.lat,lng:p.lng}));
  map.current.fitBounds(bounds,55);
  maps.current.event.addListenerOnce(map.current,'idle',()=>{if(map.current?.getZoom()>16)map.current.setZoom(16);});
 }
 useEffect(()=>{
  let alive=true,timer;const listeners=[];
  setReady(false);setState('loading');
  if(!consent)return;
  const failed=()=>{if(alive)setState('error');};
  window.addEventListener('ceac-google-map-error',failed);
  loadGoogleMaps().then(api=>{
   if(!alive||!frame.current)return;
   maps.current=api;
   map.current=new api.Map(frame.current,{
    center:points[0]?{lat:points[0].lat,lng:points[0].lng}:{lat:5.6037,lng:-.187},zoom:12,
    renderingType:'RASTER',streetViewControl:false,mapTypeControl:false,fullscreenControl:false,
    gestureHandling:'cooperative',clickableIcons:false,
    styles:[{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]}],
   });
   listeners.push(api.event.addListenerOnce(map.current,'tilesloaded',()=>{if(alive){clearTimeout(timer);setState('ready');}}));
   timer=setTimeout(failed,20000);setReady(true);
  }).catch(failed);
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener('ceac-google-map-error',failed);listeners.forEach(l=>l.remove());if(map.current)maps.current?.event.clearInstanceListeners(map.current);map.current=null;};
 },[consent,attempt]);
 useEffect(()=>{
  if(!ready||!map.current)return;
  fit();const overlays=[];
  if(!choosing){
   for(const cluster of clusters){
    const node=document.createElement('button');node.type='button';node.className='ceac-street-map-marker'+(cluster.people.some(p=>p.id===selectedId)?' is-selected':'');
    const label=cluster.people.map(p=>p.name).join(', ');
    node.dataset.workforceCluster=cluster.key;
    node.setAttribute('aria-label',cluster.people.length>1?'Select a person at this shared recorded location: '+label:'View recorded work start for '+label);node.title=label;
    const dot=document.createElement('span');dot.className='ceac-street-map-dot';dot.textContent=cluster.people.length>1?String(cluster.people.length):'';node.append(dot);
    node.onclick=()=>{selectedMarker.current=node;latest.current.onSelect?.(nextWorkforceClusterPersonId(cluster.people,latest.current.selectedId));};
    overlays.push(googleMapPoint(maps.current,map.current,cluster,node));
   }
   if(office){const node=document.createElement('span');node.className='ceac-street-map-marker ceac-office-reference';node.setAttribute('role','img');node.setAttribute('aria-label',office.name+' · Office reference');node.title=office.name+' · Reference only, not attendance proof';overlays.push(googleMapPoint(maps.current,map.current,office,node));}
  }
  return()=>overlays.forEach(o=>o.setMap(null));
 },[ready,clusters,office,focusLocation,choosing]);
 // Changing a selection must not reconstruct the map or reset the viewport.
 useEffect(()=>{const selectedKey=clusters.find(c=>c.people.some(p=>p.id===selectedId))?.key;frame.current?.querySelectorAll('[data-workforce-cluster]').forEach(node=>node.classList.toggle('is-selected',Boolean(selectedKey)&&node.dataset.workforceCluster===selectedKey));},[selectedId,clusters]);
 const officePeople=clusters.flatMap(c=>c.people).filter(p=>p.place==='office');
 return <section className="ceac-street-map" aria-label={choosing?'Choose duty venue on street map':'Recorded workforce work-start street map'}>
  <div className="ceac-street-map-viewport">
   {consent&&<div ref={frame} className="ceac-google-map-canvas" aria-label="Google Maps road map"/>}
   {choosing&&consent&&ready&&<span className="ceac-google-centre" aria-hidden="true">+</span>}
   {!consent?<div className="ceac-street-map-optin"><strong>Google Maps is hidden</strong><button className="btn btn-sm" type="button" onClick={()=>setConsent(true)}>Show Google Maps</button></div>:state!=='ready'?<div className="ceac-google-map-state" role="status">
    <strong>{state==='loading'?'Loading Google Maps…':configured?'Google Maps is unavailable':'Google Maps setup required'}</strong>
    {state==='error'&&<span>{configured?'Check the connection or map configuration. Employee records remain available below.':'A CEAC-authorised Maps key must be configured before this map can load.'}</span>}
    {state==='error'&&configured&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>setAttempt(n=>n+1)}>Retry Google Maps</button>}
   </div>:null}
  </div>
  {consent&&<div className="ceac-street-map-after"><span>Recorded starts · not live tracking</span><div><button className="btn btn-ghost btn-sm" disabled={!ready||state!=='ready'} onClick={fit}>Fit staff start locations</button> <button className="btn btn-ghost btn-sm" onClick={()=>setConsent(false)}>Hide street map</button></div></div>}
  {!choosing&&!clusters.length&&<p className="screen-note">No recorded start GPS for these filters.</p>}
  {!choosing&&officePeople.length>0&&<div className="workstart-summary" aria-label="Recorded office starts"><strong>Office starts</strong>{officePeople.map(p=><button type="button" key={p.id} aria-pressed={p.id===selectedId} onClick={e=>{selectedMarker.current=e.currentTarget;onSelect?.(p.id);}}>{p.name}</button>)}</div>}
  {clusters.filter(c=>c.people.length>1&&c.people.some(p=>p.id===selectedId)).map(c=><div className="workstart-summary" aria-label="People at this recorded location" key={c.key}>{c.people.map(p=><button type="button" key={p.id} aria-pressed={p.id===selectedId} onClick={()=>onSelect?.(p.id)}>{p.name}</button>)}</div>)}
  {selectedContent&&<section className="ceac-google-selected" aria-label="Selected work start"><button className="btn btn-ghost btn-sm" onClick={()=>{onSelect?.(null);selectedMarker.current?.focus();}}>Close selected work start</button>{selectedContent}</section>}
  {consent&&<p className="screen-note">Google Maps receives the viewed map area and device/network information to render the map. Employee names are not included in map requests. The office marker is a saved reference, not attendance proof.</p>}
  {choosing&&consent&&<button className="btn btn-sm" disabled={state!=='ready'} onClick={()=>{const p=map.current?.getCenter();if(p)onChooseLocation({lat:p.lat(),lng:p.lng()});}}>Use map centre for this venue</button>}
 </section>;
}
