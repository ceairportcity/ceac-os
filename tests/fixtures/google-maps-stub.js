// Synthetic Google SDK surface for isolated DOM/interaction tests. No real map,
// billing, credentials, Google availability or production acceptance is implied.
(()=>{
 const listeners=new WeakMap();
 const event={addListenerOnce(target,name,callback){const row={name,callback};const rows=listeners.get(target)||[];rows.push(row);listeners.set(target,rows);if(name==='tilesloaded'||name==='idle')setTimeout(()=>{callback();},5);return {remove(){}};},clearInstanceListeners(){}};
 class LatLng{constructor(lat,lng){this.latitude=lat;this.longitude=lng;}lat(){return this.latitude;}lng(){return this.longitude;}}
 class LatLngBounds{constructor(){this.points=[];}extend(p){this.points.push(p);return this;}}
 class Map{constructor(element,options){if(window.syntheticMapFail)throw new Error("Synthetic map failure");this.element=element;this.options=options;window.syntheticLastMap=this;this.zoom=options.zoom;this.centre=new LatLng(options.center.lat,options.center.lng);element.dataset.syntheticMap='true';element.tabIndex=0;element.onkeydown=e=>{if(e.key==='ArrowRight')this.centre=new LatLng(this.centre.lat(),this.centre.lng()+.001);};const label=document.createElement('span');label.textContent='Synthetic Google Maps';element.append(label);window.syntheticMaps=(window.syntheticMaps||0)+1;}
  fitBounds(bounds){this.bounds=bounds;window.syntheticMapFits=(window.syntheticMapFits||0)+1;}getZoom(){return this.zoom;}setZoom(z){this.zoom=z;}getCenter(){return this.centre;}}
 class OverlayView{setMap(map){if(this.map)this.onRemove?.();this.map=map;if(map){this.onAdd?.();this.draw?.();}}getPanes(){return {overlayMouseTarget:this.map.element};}getProjection(){return {fromLatLngToDivPixel:()=>({x:100,y:100})};}static preventMapHitsAndGesturesFrom(){}}
 window.google={maps:{Map,LatLng,LatLngBounds,OverlayView,event}};
})();
