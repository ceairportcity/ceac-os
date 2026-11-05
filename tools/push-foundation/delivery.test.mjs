import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubscription, buildPushPreview, deliveryOutcome, deliverJob } from './delivery.mjs';

const subscription = { endpoint: 'https://web.push.apple.com/example', keys: {
  auth: Buffer.alloc(16, 1).toString('base64url'),
  p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'),
} };
const record = { id: 'event-1', sensitivity: 'ordinary', senderName: 'Example Sender', senderDepartment: 'Example Department', message: 'Sent you a memo: Camp preparations.' };
const now = 1_000_000;
function fixture(overrides = {}) {
  let sent = 0, retired = 0;
  const finished = [];
  const job = { id: 'job-1', leaseToken: 'lease-1', attempt: 1, expiresAt: now + 3600_000, subscriptionId: 'device-1', subscription, record, ...overrides };
  const deps = { clock: () => now, authorize: async () => true,
    store: { claim: async () => job, expire: async () => { retired++; }, finish: async (...args) => { finished.push(args); } },
    transport: { send: async () => { sent++; return { status: 201 }; } } };
  return { job, deps, finished, sent: () => sent, retired: () => retired };
}

test('supported HTTPS subscription is copied without arbitrary fields', () => {
  assert.deepEqual(validateSubscription({ ...subscription, userId: 'untrusted' }), subscription);
});
test('rejects internal, arbitrary, credential-bearing and insecure destinations', () => {
  for (const endpoint of ['http://web.push.apple.com/x', 'https://127.0.0.1/x', 'https://example.com/x', 'https://web.push.apple.com.evil.test/x', 'https://user@web.push.apple.com/x', 'https://web.push.apple.com:8443/x', 'https://web.push.apple.com/x#fragment']) {
    assert.throws(() => validateSubscription({ ...subscription, endpoint }));
  }
});
test('rejects invalid subscription keys', () => {
  assert.throws(() => validateSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'bad' } }));
  assert.throws(() => validateSubscription({ ...subscription, keys: { ...subscription.keys, p256dh: Buffer.alloc(65).toString('base64url') } }));
});
test('private, unknown and disabled previews never expose sender or message', () => {
  for (const sensitivity of ['confidential', 'private', undefined, 'ordinary']) {
    const output = buildPushPreview({ ...record, sensitivity });
    assert.equal(output.title, 'CEAC'); assert.ok(!JSON.stringify(output).includes(record.senderName));
  }
  assert.equal(buildPushPreview({ ...record, sensitivity: 'confidential' }, { showPreview: true }).title, 'CEAC');
});
test('ordinary opt-in preview has sender, department and plain message with no arbitrary route', () => {
  const output = buildPushPreview({ ...record, url: 'https://evil.test' }, { showPreview: true });
  assert.equal(output.title, 'Example Sender · Example Department');
  assert.equal(output.body, record.message);
  assert.deepEqual(output.data, { notificationId: 'event-1' });
  assert.equal(output.tag, buildPushPreview(record).tag);
});
test('preview strips control characters and bounds text', () => {
  const output = buildPushPreview({ ...record, senderName: 'Name\u202e\nSender', message: 'x'.repeat(1000) }, { showPreview: true });
  assert.equal(output.body.length, 180); assert.ok(!output.title.includes('\u202e'));
});
test('permanent provider failures are not retried and stale devices expire', () => {
  for (const status of [400, 401, 403, 413]) assert.equal(deliveryOutcome(status, 1, now).state, 'failed');
  for (const status of [404, 410]) assert.equal(deliveryOutcome(status, 1, now).state, 'expired_subscription');
});
test('temporary failures back off with a bounded retry limit', () => {
  for (const status of [null, 408, 429, 500, 503]) assert.deepEqual(deliveryOutcome(status, 1, now), { state: 'retry', retryAt: now + 30_000 });
  assert.equal(deliveryOutcome(503, 8, now).reason, 'retry_limit');
});
test('unclaimed job cannot send', async () => {
  const f = fixture(); f.deps.store.claim = async () => null;
  assert.equal((await deliverJob('job-1', f.deps)).state, 'not_claimed'); assert.equal(f.sent(), 0);
});
test('expired and revoked jobs never reach the transport', async () => {
  const expired = fixture({ expiresAt: now });
  assert.equal((await deliverJob('job-1', expired.deps)).state, 'cancelled'); assert.equal(expired.sent(), 0);
  const revoked = fixture(); revoked.deps.authorize = async () => false;
  assert.equal((await deliverJob('job-1', revoked.deps)).reason, 'access_or_preference'); assert.equal(revoked.sent(), 0);
});
test('authorization outage retries without sending', async () => {
  const f = fixture(); f.deps.authorize = async () => { throw new Error('private details'); };
  assert.equal((await deliverJob('job-1', f.deps)).state, 'retry'); assert.equal(f.sent(), 0);
});
test('accepted delivery records completion against its lease', async () => {
  const f = fixture(); assert.equal((await deliverJob('job-1', f.deps)).state, 'sent');
  assert.equal(f.sent(), 1); assert.deepEqual(f.finished, [['job-1', 'lease-1', { state: 'sent' }]]);
});
test('expired subscription retires only the claimed device', async () => {
  const f = fixture(); const expired = []; f.deps.store.expire = async (...args) => expired.push(args);
  f.deps.transport.send = async () => ({ status: 410 });
  assert.equal((await deliverJob('job-1', f.deps)).state, 'expired_subscription');
  assert.deepEqual(expired, [['device-1', 'lease-1']]);
});
test('transport errors redact secrets and retry only within event lifetime', async () => {
  const f = fixture(); f.deps.transport.send = async () => { throw new Error('endpoint and secret'); };
  const output = await deliverJob('job-1', f.deps);
  assert.equal(output.state, 'retry'); assert.ok(!JSON.stringify(output).includes('secret'));
  const short = fixture({ expiresAt: now + 10_000 }); short.deps.transport.send = f.deps.transport.send;
  assert.equal((await deliverJob('job-1', short.deps)).reason, 'expired_before_retry');
});
