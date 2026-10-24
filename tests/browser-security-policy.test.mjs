import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {POST} from '../api/csp-report.js';
import {sealBuiltScriptPolicy,SCRIPT_BOOTSTRAP,SCRIPT_BOOTSTRAP_HASH} from '../scripts/security/seal-built-script-policy.mjs';

const origin = 'https://ceac.example.test';
const request = (body,headers={}) => new Request(origin+'/api/csp-report',{
  method:'POST',body,headers:{'content-type':'application/csp-report',...headers},
});

test('policy reports retain fixed aggregate directives and discard sensitive report content',async t=>{
  const logger = t.mock.method(console,'info',()=>{});
  const response = await POST(request(JSON.stringify({'csp-report':{
    'effective-directive':'script-src-elem','document-uri':'https://private.test/?token=SECRET',
    'blocked-uri':'https://private.test/employee','script-sample':'PRIVATE HR CONTENT',
  }})));
  assert.equal(response.status,204);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(logger.mock.calls.map(c=>c.arguments),[['CEAC CSP directive counts','{"script-src-elem":1}']]);
  assert.equal(await response.text(),'');
});

test('Reporting API batches are bounded and unknown fields/directives are ignored',async t=>{
  const logger = t.mock.method(console,'info',()=>{});
  const reports = Array.from({length:20},()=>({type:'csp-violation',body:{effectiveDirective:'connect-src',url:'PRIVATE'}}));
  assert.equal((await POST(request(JSON.stringify(reports),{'content-type':'application/reports+json'}))).status,204);
  assert.deepEqual(logger.mock.calls[0].arguments,['CEAC CSP directive counts','{"connect-src":10}']);
  logger.mock.resetCalls();
  assert.equal((await POST(request(JSON.stringify({'csp-report':{'effective-directive':'SECRET'}})))).status,204);
  assert.equal(logger.mock.callCount(),0);
});

test('cross-site, wrong content types and oversized reports are rejected without reading their bodies',async()=>{
  for (const [headers,status] of [
    [{origin:'https://other.test'},403],[{'sec-fetch-site':'cross-site'},403],
    [{'content-type':'text/plain'},415],[{'content-length':'17000'},413],
  ]) {
    const input=request('PRIVATE',headers);
    assert.equal((await POST(input)).status,status);
    assert.equal(input.bodyUsed,false);
  }
  assert.equal((await POST(new Request(origin+'/api/csp-report'))).status,405);
});

test('chunked oversize bodies are cancelled and malformed JSON is never logged',async t=>{
  const logger = t.mock.method(console,'info',()=>{});
  let cancelled=false;
  const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(17000));},cancel(){cancelled=true;}});
  const input=new Request(origin+'/api/csp-report',{method:'POST',body,duplex:'half',headers:{'content-type':'application/csp-report'}});
  assert.equal((await POST(input)).status,413);
  assert.equal(cancelled,true);
  assert.equal((await POST(request('not-json PRIVATE'))).status,400);
  assert.equal((await POST(request(new Uint8Array([255])))).status,400);
  assert.equal(logger.mock.callCount(),0);
});

test('static entry integrity tracks emitted bytes through a fixed hash-authorised bootstrap',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ceac-csp-'));
  try {
    await mkdir(join(root,'assets'));
    const source='globalThis.safeEntry=true;';
    await writeFile(join(root,'assets','entry.js'),source);
    await writeFile(join(root,'index.html'),'<!doctype html><head><meta charset="UTF-8" /><script type="module" crossorigin src="/assets/entry.js"></script></head>');
    await sealBuiltScriptPolicy(root);
    let html=await readFile(join(root,'index.html'),'utf8');
    const digest='sha384-'+createHash('sha384').update(source).digest('base64');
    assert.ok(html.includes('data-integrity="'+digest+'"'));
    assert.ok(html.includes('data-src="/assets/entry.js"'));
    assert.ok(html.includes('>'+SCRIPT_BOOTSTRAP+'</script>'));
    assert.ok(!html.includes('<script type="module"'));
    await sealBuiltScriptPolicy(root);
    assert.equal(await readFile(join(root,'index.html'),'utf8'),html);
    await writeFile(join(root,'assets','entry.js'),source+'\n// changed');
    await sealBuiltScriptPolicy(root);
    html=await readFile(join(root,'index.html'),'utf8');
    assert.ok(!html.includes(digest));
  } finally {await rm(root,{recursive:true,force:true});}
});

test('hosting policy permits required resources while rejecting script and object injection',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key.toLowerCase(),h.value]));
  const directives=Object.fromEntries(headers['content-security-policy'].split(';').map(s=>{const [name,...values]=s.trim().split(/\s+/);return [name,values];}));
  assert.deepEqual(directives['script-src'],["'"+SCRIPT_BOOTSTRAP_HASH+"'","'strict-dynamic'","'report-sample'"]);
  assert.deepEqual(directives['script-src-attr'],["'none'"]);
  for (const directive of ['object-src','base-uri','frame-ancestors']) assert.deepEqual(directives[directive],["'none'"]);
  assert.ok(directives['connect-src'].includes('https://efjljhftsesssumtshvp.supabase.co'));
  assert.ok(directives['connect-src'].includes('wss://efjljhftsesssumtshvp.supabase.co'));
  assert.ok(directives['worker-src'].includes("'self'"));
  assert.ok(directives['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(directives['font-src'].includes('https://fonts.gstatic.com'));
  assert.ok(directives['frame-src'].includes('https://www.openstreetmap.org'));
  assert.equal(headers['reporting-endpoints'],'ceac-csp="/api/csp-report"');
  assert.ok(directives['report-uri'].includes('/api/csp-report'));
  assert.ok(!new RegExp('^'+config.rewrites[0].source+'$').test('/api/csp-report'));
  assert.ok(new RegExp('^'+config.rewrites[0].source+'$').test('/ordinary/app/path'));
});
