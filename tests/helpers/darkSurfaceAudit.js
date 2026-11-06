// Run inside the browser. Audit rendered surfaces, not source colour spellings.
export function darkSurfaceAudit() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', {willReadFrequently:true}), cache = new Map();
  const rgba = value => {
    if (!cache.has(value)) {
      ctx.clearRect(0,0,1,1); ctx.fillStyle = value; ctx.fillRect(0,0,1,1);
      cache.set(value, [...ctx.getImageData(0,0,1,1).data].map((n,i)=>i===3?n/255:n));
    }
    return cache.get(value);
  };
  const over = (a,b) => [0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
  const lum = c => c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)
    .reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const excluded = '.ceac-theme-preview,.leaflet-container,.gm-style,canvas,img,video,iframe';
  const issues = [], seen = new Set();
  for (const el of document.querySelectorAll('.app *,[role="dialog"],[role="dialog"] *,[role="menu"],[role="menu"] *')) {
    if (el.closest(excluded) || el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"],[hidden],[inert]')) continue;
    const style = getComputedStyle(el), box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || style.visibility !== 'visible' || style.display === 'none') continue;
    const label = `${el.tagName.toLowerCase()}.${String(el.className?.baseVal??el.className).split(' ').join('.')}`;
    const bg = rgba(style.backgroundColor);
    if (box.width*box.height>900 && bg[3]>.4 && bg.slice(0,3).every(n=>n>175)) {
      issues.push({kind:'light surface',element:label,background:style.backgroundColor});
    }
    if(box.width*box.height>900 && style.backgroundImage.includes('gradient(') && !style.backgroundImage.includes('url(')){
      const stops=style.backgroundImage.match(/rgba?\([^)]*\)|color\([^)]*\)/g)||[];
      if(stops.map(rgba).some(c=>c[3]>.4&&c.slice(0,3).every(n=>n>175)))issues.push({kind:'light gradient',element:label,background:style.backgroundImage});
    }
    const text = [...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim()
      || (el.matches('input,textarea') ? el.value || el.placeholder : '');
    if (!text || el.closest('svg')) continue;
    let base = [20,23,27,1], image = false;
    const chain=[]; for(let node=el;node;node=node.parentElement)chain.unshift(node);
    for(const node of chain){const s=getComputedStyle(node);base=over(rgba(s.backgroundColor),base);if(s.backgroundImage!=='none')image=true;}
    // Photographs/gradients have no single background colour. Their surfaces
    // are separately checked above and their screenshots require visual review.
    if(image)continue;
    const color=el.matches('input,textarea')&&!el.value?getComputedStyle(el,'::placeholder').color:style.color;
    const foreground=over(rgba(color),base), a=lum(foreground), b=lum(base), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.667 && Number(style.fontWeight)>=700);
    const floor=large?3:4.5;
    if(ratio+.005<floor){const key=label+':'+text.slice(0,80);if(!seen.has(key)){seen.add(key);issues.push({kind:'text contrast',element:label,text:text.slice(0,90),color,background:base.slice(0,3).map(Math.round),ratio:+ratio.toFixed(2),required:floor});}}
  }
  return issues;
}
