// Same-origin policy diagnostics only. Never log report URLs, samples, headers,
// identities or request bodies; only fixed directive names and aggregate counts.
const LIMIT = 16 * 1024;
const DIRECTIVES = new Set([
  'default-src','script-src','script-src-elem','script-src-attr','style-src',
  'style-src-elem','style-src-attr','img-src','font-src','connect-src','media-src',
  'frame-src','frame-ancestors','worker-src','object-src','base-uri','form-action',
  'manifest-src','require-trusted-types-for','trusted-types',
]);
const reply = (status, extra = {}) => new Response(null, {
  status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra},
});

export async function POST(request) {
  if (request.method !== 'POST') return reply(405, {Allow:'POST'});
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin)
    || request.headers.get('sec-fetch-site') === 'cross-site') return reply(403);
  const type = request.headers.get('content-type')?.split(';')[0].trim();
  if (!['application/csp-report','application/reports+json'].includes(type)) return reply(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMIT)) return reply(413);
  if (!request.body) return reply(400);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    const payload = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    const reports = Array.isArray(payload)
      ? payload.slice(0,10).filter(r=>r?.type === 'csp-violation').map(r=>r.body)
      : [payload?.['csp-report']];
    const counts = {};
    for (const report of reports) {
      const directive = report?.effectiveDirective ?? report?.['effective-directive'];
      if (DIRECTIVES.has(directive)) counts[directive] = (counts[directive] || 0) + 1;
    }
    if (Object.keys(counts).length) console.info('CEAC CSP directive counts',JSON.stringify(counts));
    return reply(204);
  } catch { return reply(400); }
  finally { reader.releaseLock(); }
}
