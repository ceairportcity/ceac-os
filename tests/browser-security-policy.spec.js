import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {sealBuiltScriptPolicy} from '../scripts/security/seal-built-script-policy.mjs';
import {POST} from '../api/csp-report.js';

let server,origin,fixtureRoot;
const backend=process.env.SUPABASE_URL;
const rolePassword=process.env.ROLE_FIXTURE_PASSWORD;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};

test.beforeAll(async()=>{
  test.setTimeout(120000);
  if (backend && !['127.0.0.1','localhost'].includes(new URL(backend).hostname)) throw new Error('CSP role verification requires a disposable local backend');
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
  fixtureRoot=await mkdtemp(join(tmpdir(),'ceac-csp-browser-'));
  await mkdir(join(fixtureRoot,'assets'));
  await writeFile(join(fixtureRoot,'assets','csp-probe.js'),`
    globalThis.cspProbe={evalBlocked:false,worker:false};
    try { new Function('globalThis.unsafeEvalRan=true')(); } catch { cspProbe.evalBlocked=true; }
    const worker=new Worker('/assets/probe-worker.js');
    worker.onmessage=()=>{cspProbe.worker=true;worker.terminate();};
    document.querySelector('#probe-status').textContent='ready';
  `);
  await writeFile(join(fixtureRoot,'index.html'),`<!doctype html><html><head><meta charset="UTF-8" />
    <base href="https://blocked.example.test/" />
    <script>globalThis.unsafeInlineRan=true</script>
    <script src="https://blocked.example.test/foreign.js"></script>
    <script src="/assets/untrusted.js"></script>
    <script type="module" crossorigin src="/assets/csp-probe.js"></script></head>
    <body><p id="probe-status">pending</p><button onclick="globalThis.unsafeHandlerRan=true">Probe</button></body></html>`);
  await sealBuiltScriptPolicy(fixtureRoot);
  server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,origin);
      if (url.pathname==='/api/csp-report') {
        const input=new Request(url,{method:req.method,headers:req.headers,
          ...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
        const output=await POST(input);
        res.writeHead(output.status,Object.fromEntries(output.headers));res.end();return;
      }
      // Test transport only. Genuine fixture JWTs/RLS stay on the local backend;
      // no synthetic token or request ever reaches a production project.
      if (url.pathname.startsWith('/supabase/')) {
        if (!backend) {res.writeHead(503);res.end();return;}
        const forwarded={...req.headers};delete forwarded.host;
        const upstream=await fetch(backend+url.pathname.slice('/supabase'.length)+url.search,{
          method:req.method,headers:forwarded,redirect:'manual',
          ...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{}),
        });
        const responseHeaders=Object.fromEntries(upstream.headers);
        for (const key of ['content-length','content-encoding','transfer-encoding','connection']) delete responseHeaders[key];
        res.writeHead(upstream.status,responseHeaders);
        if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);else res.end();return;
      }
      res.setHeader('Content-Security-Policy',headers['Content-Security-Policy']);
      res.setHeader('Reporting-Endpoints',headers['Reporting-Endpoints']);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Cache-Control','no-store');
      if (url.pathname==='/assets/probe-worker.js') {res.setHeader('Content-Type','text/javascript');res.end('postMessage("ready")');return;}
      if (url.pathname==='/assets/untrusted.js') {res.setHeader('Content-Type','text/javascript');res.end('globalThis.unsafeSameOriginRan=true');return;}
      let path;
      if (url.pathname==='/csp-probe'||url.pathname==='/csp-tampered') path=join(fixtureRoot,'index.html');
      else if (url.pathname==='/assets/csp-probe.js') path=join(fixtureRoot,'assets','csp-probe.js');
      else {
        const root=resolve('dist');path=resolve(root,'.'+url.pathname);
        if (!path.startsWith(root+'/')||url.pathname==='/') path=join(root,'index.html');
      }
      let bytes=await readFile(path);
      if (url.pathname==='/csp-tampered') bytes=Buffer.from(bytes.toString().replace('data-src="/assets/csp-probe.js"','data-src="/assets/csp-probe.js?tamper=1"'));
      if (url.searchParams.has('tamper')) bytes=Buffer.concat([bytes,Buffer.from('\nglobalThis.tamperedScriptRan=true;')]);
      res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(bytes);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  origin='http://127.0.0.1:'+server.address().port;
  execFileSync('npm',['run','build'],{stdio:'pipe',env:{...process.env,
    VITE_SUPABASE_URL:origin+'/supabase',
    VITE_SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_ANON_KEY||'isolated-csp-fixture-key',
  }});
});

test.afterAll(async()=>{
  if (server) {server.closeAllConnections();await new Promise(r=>server.close(r));}
  if (fixtureRoot) await rm(fixtureRoot,{recursive:true,force:true});
});

test('real browser blocks untrusted scripts, inline handlers, eval and base hijacking while allowing sealed modules and workers',async({page})=>{
  await page.goto(origin+'/csp-probe');
  await expect(page.locator('#probe-status')).toHaveText('ready');
  await expect.poll(()=>page.evaluate(()=>globalThis.cspProbe?.worker)).toBe(true);
  await page.getByRole('button',{name:'Probe',exact:true}).click();
  expect(await page.evaluate(()=>({
    inline:!!globalThis.unsafeInlineRan,foreign:!!globalThis.unsafeSameOriginRan,
    handler:!!globalThis.unsafeHandlerRan,eval:!!globalThis.unsafeEvalRan,
    evalBlocked:globalThis.cspProbe.evalBlocked,base:document.baseURI,
  }))).toEqual({inline:false,foreign:false,handler:false,eval:false,evalBlocked:true,base:origin+'/csp-probe'});
});

test('altered entry bytes fail integrity verification',async({page})=>{
  await page.goto(origin+'/csp-tampered');
  await expect(page.locator('#probe-status')).toHaveText('pending');
  expect(await page.evaluate(()=>!!globalThis.cspProbe||!!globalThis.tamperedScriptRan)).toBe(false);
});

test('actual production bundle loads sign-in under the enforced script policy',async({page})=>{
  const violations=[];
  page.on('console',m=>{if (/violat|Content Security|TrustedScript/i.test(m.text())) violations.push(m.text());});
  const response=await page.goto(origin+'/');
  expect(response.headers()['content-security-policy']).toContain("object-src 'none'");
  await expect(page.getByRole('textbox',{name:'Work email',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in to CEAC OS',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Work email',exact:true})).toBeVisible();
  expect(violations).toEqual([]);
});

for (const [email,labels] of [
  ['staff@ceac.local.test',['Today','Work','My Hub']],
  ['manager@ceac.local.test',['Overview','Work','Reports']],
  ['admin@ceac.local.test',['Overview','People & Access','Reviews & Development','Learning']],
  ['exec@ceac.local.test',['Overview','Ministry','Reports']],
]) test('built application and role navigation remain usable with CSP: '+email,async({page})=>{
  test.skip(!rolePassword||!backend,'Requires the existing isolated role fixtures');
  const violations=[];
  page.on('console',m=>{if (/violat|Content Security|TrustedScript/i.test(m.text())) violations.push(m.text());});
  await page.goto(origin+'/');
  await page.getByRole('textbox',{name:'Work email',exact:true}).fill(email);
  await page.getByLabel(/^Password/).fill(rolePassword);
  await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();
  const nav=page.locator('.ev2s-sidebar-nav');
  await expect(nav).toBeVisible();
  for (const label of labels) await expect(nav.getByRole('button',{name:label,exact:true})).toBeVisible();
  if (email.startsWith('admin@')) {
    await nav.getByRole('button',{name:'Learning',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Learning',exact:true})).toBeVisible();
    await expect(nav.getByRole('button',{name:'Compliance',exact:true})).toHaveCount(0);
  }
  expect(violations).toEqual([]);
});
