// CEAC's browser key must be restricted to CEAC origins and Maps JavaScript API.
// Never reuse a key from another product or place server credentials here.
export const googleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
let pending;
let authorisationFailed=false;
const failures={
 'MAP-SETUP':'Google Maps has not been configured for CEAC.',
 'MAP-DOWNLOAD':'The Google Maps download failed. A connection or content blocker may be preventing it.',
 'MAP-SDK-TIMEOUT':'The Google Maps download did not finish in time.',
 'MAP-AUTH':'Google rejected the map configuration. CEAC must check the key, authorised website, API and billing settings.',
 'MAP-POLICY':'A website security rule blocked a Google Maps resource.',
 'MAP-INITIALISE':'Google Maps downloaded but could not open the map.',
 'MAP-TILES-TIMEOUT':'Google Maps opened, but the street images did not finish loading.',
};
// Only fixed, non-personal diagnostics reach the interface. Never expose SDK
// errors, request URLs (which contain the key), employee data or browser logs.
export function googleMapFailure(error,fallback='MAP-INITIALISE'){
 const code=Object.hasOwn(failures,error?.code)?error.code:fallback;
 return {code,message:failures[code]||failures['MAP-INITIALISE']};
}
function mapError(code){return Object.assign(new Error(failures[code]),{code});}
export function loadGoogleMaps() {
 if (authorisationFailed) return Promise.reject(mapError('MAP-AUTH'));
 if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
 if (!googleMapsConfigured) return Promise.reject(mapError('MAP-SETUP'));
 if (pending) return pending;
 pending = new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  let settled=false;
  const fail=(code)=>{
   if(authorisationFailed)code='MAP-AUTH';
   const error=mapError(code);
   if(code==='MAP-AUTH')authorisationFailed=true;
   if(!settled){settled=true;clearTimeout(timer);delete window.__ceacGoogleMapsReady;script.remove();pending=null;reject(error);}
   window.dispatchEvent(new CustomEvent('ceac-google-map-error',{detail:googleMapFailure(error)}));
  };
  const timer=setTimeout(()=>fail('MAP-SDK-TIMEOUT'),20000);
  window.gm_authFailure=()=>fail('MAP-AUTH');
  window.__ceacGoogleMapsReady=()=>{
   if(settled)return;
   if(!window.google?.maps?.Map){fail('MAP-INITIALISE');return;}
   settled=true;clearTimeout(timer);delete window.__ceacGoogleMapsReady;resolve(window.google.maps);
  };
  script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key:import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim(),v:'quarterly',loading:'async',callback:'__ceacGoogleMapsReady'});
  script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';script.onerror=()=>fail('MAP-DOWNLOAD');
  document.head.appendChild(script);
 });
 return pending;
}


// Google road-view fallback for read-only workforce maps when the JavaScript
// SDK cannot download. Only numeric map coordinates reach Google; employee
// names, work-session IDs and the browser API key are not included.
export function googleMapsFallbackUrl(point){
 const lat=Number(point?.lat),lng=Number(point?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)return null;
 return 'https://www.google.com/maps?'+new URLSearchParams({q:lat+','+lng,z:'15',output:'embed'}).toString();
}

// DOM content is created locally, never interpolated as HTML or put in map URLs.
export function googleMapPoint(maps,map,position,node){
 const point=new maps.OverlayView();
 point.onAdd=()=>{point.getPanes().overlayMouseTarget.appendChild(node);maps.OverlayView.preventMapHitsAndGesturesFrom(node);};
 point.draw=()=>{const p=point.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(position.lat,position.lng));if(p){node.style.left=p.x+'px';node.style.top=p.y+'px';}};
 point.onRemove=()=>node.remove();point.setMap(map);return point;
}
