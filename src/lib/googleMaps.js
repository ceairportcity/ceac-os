// CEAC's browser key must be restricted to CEAC origins and Maps JavaScript API.
// Never reuse a key from another product or place server credentials here.
export const googleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
let pending;
export function loadGoogleMaps() {
 if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
 if (!googleMapsConfigured) return Promise.reject(new Error('Google Maps setup is required. Employee records remain available below.'));
 if (pending) return pending;
 pending = new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  let settled=false;
  const fail=()=>{
   if(!settled){settled=true;clearTimeout(timer);delete window.__ceacGoogleMapsReady;script.remove();pending=null;reject(new Error('Google Maps could not load. Check the connection or map configuration.'));}
   window.dispatchEvent(new Event('ceac-google-map-error'));
  };
  const timer=setTimeout(fail,20000);
  window.gm_authFailure=fail;
  window.__ceacGoogleMapsReady=()=>{
   if(settled)return;
   if(!window.google?.maps?.Map){fail();return;}
   settled=true;clearTimeout(timer);delete window.__ceacGoogleMapsReady;resolve(window.google.maps);
  };
  script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key:import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim(),v:'quarterly',loading:'async',callback:'__ceacGoogleMapsReady'});
  script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';script.onerror=fail;
  document.head.appendChild(script);
 });
 return pending;
}

// DOM content is created locally, never interpolated as HTML or put in map URLs.
export function googleMapPoint(maps,map,position,node){
 const point=new maps.OverlayView();
 point.onAdd=()=>{point.getPanes().overlayMouseTarget.appendChild(node);maps.OverlayView.preventMapHitsAndGesturesFrom(node);};
 point.draw=()=>{const p=point.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(position.lat,position.lng));if(p){node.style.left=p.x+'px';node.style.top=p.y+'px';}};
 point.onRemove=()=>node.remove();point.setMap(map);return point;
}
