import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';

// Keep the bootstrap bytes fixed so the hosting header can authorise its hash
// across builds. A non-parser-inserted module carries strict-dynamic trust into
// its import graph; a parser-inserted external module's SRI hash does not.
export const SCRIPT_BOOTSTRAP = '(()=>{const e=document.currentScript,l=()=>{const s=document.createElement("script");s.type="module";s.async=false;s.src=e.dataset.src;s.integrity=e.dataset.integrity;s.crossOrigin="anonymous";document.head.appendChild(s)};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",l,{once:true});else l()})();';
export const SCRIPT_BOOTSTRAP_HASH = 'sha384-'+createHash('sha384').update(SCRIPT_BOOTSTRAP).digest('base64');

// Static Vite HTML cannot have per-request nonces. Seal the actual emitted
// entry bytes with SRI, loaded only by the fixed hash-authorised bootstrap.
export async function sealBuiltScriptPolicy(directory = 'dist') {
  const root = resolve(directory);
  const path = resolve(root,'index.html');
  let html = await readFile(path,'utf8');
  const entries = [
    ...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g),
    ...html.matchAll(/<script\b[^>]*\bdata-ceac-entry\b[^>]*\bdata-src="([^"]+)"[^>]*>[\s\S]*?<\/script>/g),
  ];
  if (!entries.length) throw new Error('No emitted application module found for CSP sealing');
  for (const [tag,src] of entries) {
    if (!/^\/assets\/[A-Za-z0-9_./-]+\.js$/.test(src)) throw new Error('Unexpected application script location');
    const asset = resolve(root,'.'+src);
    if (relative(root,asset).startsWith('..')) throw new Error('Application script escapes build output');
    const hash = 'sha384-'+createHash('sha384').update(await readFile(asset)).digest('base64');
    html = html.replace(tag,'<script data-ceac-entry data-src="'+src+'" data-integrity="'+hash+'">'+SCRIPT_BOOTSTRAP+'</script>');
  }
  await writeFile(path,html);
  return {entryCount:entries.length,bootstrapHash:SCRIPT_BOOTSTRAP_HASH};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await sealBuiltScriptPolicy(process.argv[2]);
  console.log('Sealed application script entries:',result.entryCount);
}
