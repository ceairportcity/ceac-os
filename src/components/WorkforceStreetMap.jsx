import {useEffect,useMemo,useRef,useState} from "react";
import {fitWorkforceMap,pointCoordinates,visibleStreetTiles,workforcePinPosition,worldPoint,nextWorkforceClusterPersonId} from "../lib/workforceStreetMap";
import "./WorkforceStreetMap.css";
const EMPTY_CLUSTERS=[];

/** Owner-approved default street view. Only tile area, site origin and browser IP
 * reach OpenStreetMap; identities and staff records stay in first-party memory. */
export default function WorkforceStreetMap({clusters=EMPTY_CLUSTERS,office=null,selectedId,onSelect,selectedContent,focusLocation=null,onChooseLocation}) {
 const choosing=typeof onChooseLocation==="function";
 const frame=useRef(null),drag=useRef(null),selectedMarker=useRef(null);
 const [size,setSize]=useState({width:520,height:340}),[consent,setConsent]=useState(true),[tileWarning,setTileWarning]=useState(false);
 const fitted=useMemo(()=>fitWorkforceMap(focusLocation?[focusLocation]:office?[...clusters,office]:clusters,size.width,size.height),[clusters,office,focusLocation,size.width,size.height]);
 const [view,setView]=useState(fitted);
 const [tileAttempt,setTileAttempt]=useState(0);
 const failedTiles=useRef(new Set());
 useEffect(()=>{setView(fitted);},[fitted]);
 useEffect(()=>{
  if(!frame.current)return;
  if(typeof ResizeObserver==="undefined"){
   const measure=()=>{const rect=frame.current?.getBoundingClientRect();if(rect)setSize({width:Math.max(200,Math.round(rect.width)),height:Math.max(200,Math.round(rect.height))});};
   measure();window.addEventListener("resize",measure);
   return ()=>window.removeEventListener("resize",measure);
  }
  const observer=new ResizeObserver(entries=>{
   const width=Math.max(200,Math.round(entries[0]?.contentRect?.width||520));
   const height=Math.max(200,Math.round(entries[0]?.contentRect?.height||340));
   setSize(old=>old.width===width&&old.height===height?old:{width,height});
  });
  observer.observe(frame.current);
  return ()=>observer.disconnect();
 },[]);
 const tileViews=useMemo(()=>consent?visibleStreetTiles(view,view.zoom,size.width,size.height):[],
  [consent,view,size.width,size.height]);
 const tileScope=tileViews.map(tile=>tile.key).join("|")+":"+tileAttempt;
 useEffect(()=>{failedTiles.current.clear();setTileWarning(false);},[tileScope]);
 const pins=useMemo(()=>clusters.map(cluster=>({...cluster,position:workforcePinPosition(cluster,view,view.zoom,size.width,size.height)})),
  [clusters,view,size.width,size.height]).filter(p=>p.position.x>=-30&&p.position.x<=size.width+30
   &&p.position.y>=-30&&p.position.y<=size.height+30);

 const selectedPin=pins.find(pin=>pin.people.some(person=>person.id===selectedId));
 // Place the scrollable detail on the opposite side of the selected marker.
 // Shared-location pins must remain reachable even on a narrow phone.
 const popupEdge=selectedPin?.position.y<size.height/2?"top":"bottom";
 const popupInset=Math.max(12,popupEdge==="top"?(selectedPin?.position.y||0)+32:size.height-(selectedPin?.position.y||size.height)+32);
 const popupStyle={top:"auto",bottom:"auto",[popupEdge]:popupInset,maxHeight:Math.max(80,size.height-popupInset-28)};
 function closeSelection(){
  onSelect?.(null);
  selectedMarker.current?.focus();
 }
 function changeZoom(step){
  setView(current=>({...current,zoom:Math.min(17,Math.max(2,current.zoom+step))}));
 }
 function pointerDown(event){
  if(!consent||event.button!==0)return;
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,original:view};
  event.currentTarget.setPointerCapture?.(event.pointerId);
 }
 function pointerMove(event){
  if(!drag.current||drag.current.pointer!==event.pointerId)return;
  const {x,y,original}=drag.current;
  const middle=worldPoint(original.lat,original.lng,original.zoom);
  const coord=pointCoordinates(middle.x-(event.clientX-x),middle.y-(event.clientY-y),original.zoom);
  setView({...original,...coord});
 }
 function pointerEnd(event){
  if(drag.current?.pointer===event.pointerId)drag.current=null;
  if(event.currentTarget.hasPointerCapture?.(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
 }
 function panWithKeyboard(event){
  if(!choosing||!consent||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.target!==event.currentTarget)return;
  const direction={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[event.key];
  if(!direction)return;
  event.preventDefault();
  setView(current=>{const middle=worldPoint(current.lat,current.lng,current.zoom);return {...current,...pointCoordinates(middle.x+direction[0],middle.y+direction[1],current.zoom)};});
 }
 return <section className="ceac-street-map" aria-label={choosing?"Choose duty venue on street map":"Recorded workforce work-start street map"}>
  <div ref={frame} className="ceac-street-map-viewport"
   tabIndex={choosing?0:undefined} role={choosing?"group":undefined} aria-label={choosing?"Venue map. Use arrow keys to move the map centre.":undefined} onKeyDown={panWithKeyboard}
   onPointerDown={pointerDown} onPointerMove={pointerMove}
   onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
   style={{touchAction:consent?"none":"auto"}}>
   {!consent?<div className="ceac-street-map-optin">
    <span className="ceac-street-map-eyebrow">GEOGRAPHIC VIEW</span>
    <strong>View recorded work starts on a street map</strong>
    <p>OpenStreetMap tiles show roads and nearby places. Loading them sends the visible map area, the CEAC site origin and your IP address to OpenStreetMap. Staff identities and exact work-start records are not sent to the map provider.</p>
    <button type="button" className="btn btn-sm" onClick={()=>{setTileWarning(false);setConsent(true);}}>
     Enable street map
    </button>
    {!clusters.length&&<small>No recorded start GPS is available for these employees.</small>}
   </div>:<>
    <div className="ceac-street-map-tiles" aria-hidden="true">
     {tileViews.map(tile=><img key={`${tile.key}:${tileAttempt}`} src={tile.url}
      loading="eager" draggable="false" alt="" referrerPolicy="strict-origin-when-cross-origin"
      onError={event=>{event.currentTarget.style.visibility="hidden";failedTiles.current.add(tile.key);setTileWarning(true);}}
      onLoad={event=>{event.currentTarget.style.visibility="visible";failedTiles.current.delete(tile.key);setTileWarning(failedTiles.current.size>0);}}
      style={{position:"absolute",left:tile.x,top:tile.y,width:256,height:256}} />)}
    </div>
    <div className="ceac-street-map-overlay" aria-label={choosing?"Venue reference and selection":"Recorded work-start markers"}>
     {choosing&&<span className="ceac-street-map-marker is-selected" role="img" aria-label="Venue selection at map centre" style={{left:"50%",top:"50%",pointerEvents:"none"}}>+<span className="ceac-street-map-name">Venue point</span></span>}
     {office&&<span className="ceac-street-map-marker ceac-office-reference" role="img" aria-label={"CEAC main office · "+office.name+" · Reference only, not attendance proof"}
      style={(()=>{const p=workforcePinPosition(office,view,view.zoom,size.width,size.height);return {left:p.x,top:p.y};})()}>
      <span aria-hidden="true">◆</span><span className="ceac-street-map-name">CEAC main office</span>
     </span>}
     {pins.map(pin=><button key={pin.key} type="button"
      className={pin.people.some(person=>person.id===selectedId)?"ceac-street-map-marker is-selected":"ceac-street-map-marker"}
      style={{left:pin.position.x,top:pin.position.y}}
      aria-label={pin.people.length===1?`View recorded work start for ${pin.people[0].name}`:
       `Select a person at this shared work-start location (${pin.people.length} staff). Press again for next person`}
      onPointerDown={e=>e.stopPropagation()}
      onClick={event=>{selectedMarker.current=event.currentTarget;onSelect?.(nextWorkforceClusterPersonId(pin.people,selectedId));}}>
      {pin.people.length===1?<><span aria-hidden="true">●</span><span className="ceac-street-map-name">{pin.people[0].name}</span></>:pin.people.length}
     </button>)}
    </div>
    {selectedContent&&<div className="ceac-street-map-popup" style={popupStyle} role="region" aria-label="Selected work start" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();closeSelection();}}} onPointerDown={e=>e.stopPropagation()}><button type="button" className="ceac-street-map-close" aria-label="Close selected work start" onClick={closeSelection}>×</button>{selectedContent}</div>}
    <div className="ceac-street-map-zoom">
     <button type="button" aria-label="Zoom in on street map" onPointerDown={e=>e.stopPropagation()} onClick={()=>changeZoom(1)}>+</button>
     <button type="button" aria-label="Zoom out of street map" onPointerDown={e=>e.stopPropagation()} onClick={()=>changeZoom(-1)}>−</button>
     <button type="button" aria-label={choosing?"Return to saved location":"Fit staff start locations"} onPointerDown={e=>e.stopPropagation()} onClick={()=>setView(fitted)}>⌖</button>
    </div>
    <div className="ceac-street-map-footer">
     <span>{choosing?"Venue setup · Not attendance proof":"Recorded start · Not live tracking"}</span>
     <span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></span>
    </div>
   </>}
  </div>
  {consent&&<p className="screen-note">OpenStreetMap receives the visible map area, the CEAC site origin and your IP address. Staff identities and exact work-start records are not sent to the map provider. {office?"The office pin is a saved reference, not attendance proof.":"No saved office reference is available."} {!choosing&&!clusters.length&&"No recorded start GPS is available for these employees."}</p>}
  {consent&&<div className="ceac-street-map-after">
   <span>{choosing?(tileWarning?"Street tiles could not all load. Check that the venue point is correct before saving.":"Drag the map, or focus it and use arrow keys. Place the venue under the centre marker, then choose that point."):tileWarning?"The street background could not load from OpenStreetMap. Check this PC’s connection or content-blocking settings, then retry. Employee records remain available through Browse employees.":"Drag to explore. Use zoom controls to inspect streets. A pin opens a staff record; activate shared-location pins again to inspect every person there."}</span>
   {tileWarning&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>setTileAttempt(attempt=>attempt+1)}>Retry street map</button>}
   <button className="btn btn-ghost btn-sm" type="button" onClick={()=>setConsent(false)}>Hide street map</button>
  </div>}
  {choosing&&consent&&<button className="btn" type="button" onClick={()=>onChooseLocation({lat:view.lat,lng:view.lng})}>Use map centre for this venue</button>}
 </section>;
}
