// Dormant server-only foundation. No app imports, network client, scheduler or database writes.
import { Buffer } from 'node:buffer';

const providers = new Set(['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']);
const text = (value, limit) => String(value ?? '').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);

export function validateSubscription(input) {
  if (!input || typeof input.endpoint !== 'string' || input.endpoint.length > 4096) throw new Error('Invalid push subscription');
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== 'https:' || !providers.has(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.port || endpoint.hash) throw new Error('Unsupported push endpoint');
  for (const [name, length] of [['auth', 16], ['p256dh', 65]]) {
    const key = input.keys?.[name];
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]+$/.test(key) || Buffer.from(key, 'base64url').length !== length) throw new Error('Invalid subscription key');
  }
  if (Buffer.from(input.keys.p256dh, 'base64url')[0] !== 4) throw new Error('Invalid public key format');
  return { endpoint: endpoint.href, keys: { auth: input.keys.auth, p256dh: input.keys.p256dh } };
}

// Content must come from an authorised server record, never an arbitrary client body.
// Unknown sensitivity defaults to a private preview. No destination URL is accepted.
export function buildPushPreview(record, { showPreview = false } = {}) {
  if (!record || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id || '')) throw new Error('Invalid notification ID');
  const visible = showPreview === true && record.sensitivity === 'ordinary';
  const actor = text(record.senderName, 80);
  const department = text(record.senderDepartment, 60);
  return {
    title: visible && actor ? [actor, department].filter(Boolean).join(' · ') : 'CEAC',
    body: visible ? text(record.message, 180) || 'You have a new update.' : 'You have a new private update. Open CEAC to read it.',
    tag: `ceac-${record.id}`,
    data: { notificationId: record.id },
  };
}

export function deliveryOutcome(status, attempt, now) {
  if (!Number.isInteger(attempt) || attempt < 1 || !Number.isFinite(now)) throw new Error('Invalid delivery attempt');
  if (Number.isInteger(status) && status >= 200 && status < 300) return { state: 'sent' };
  if (status === 404 || status === 410) return { state: 'expired_subscription' };
  if (status === null || status === 408 || status === 429 || (status >= 500 && status <= 599)) {
    if (attempt >= 8) return { state: 'failed', reason: 'retry_limit' };
    return { state: 'retry', retryAt: now + Math.min(60 * 60_000, 30_000 * 2 ** (attempt - 1)) };
  }
  return { state: 'failed', reason: 'provider_rejected' };
}

// Integration contract: claim atomically leases one event/device pair and increments
// attempt. finish must compare the lease token; expire must remove only this device.
// Native Web Push has no exactly-once receipt: a crash after provider acceptance can
// duplicate delivery. A stable tag reduces repeated visible cards; it is not a receipt.
export async function deliverJob(jobId, { store, authorize, transport, clock = Date.now }) {
  const job = await store.claim(jobId);
  if (!job) return { state: 'not_claimed' };
  if (!Number.isInteger(job.attempt) || job.attempt < 1 || !job.leaseToken) throw new Error('Invalid claimed job');
  let result;
  if (!Number.isFinite(job.expiresAt) || job.expiresAt <= clock()) result = { state: 'cancelled', reason: 'expired_event' };
  else {
    let permitted;
    try { permitted = await authorize(job); }
    catch { result = deliveryOutcome(null, job.attempt, clock()); }
    if (!result && permitted !== true) result = { state: 'cancelled', reason: 'access_or_preference' };
    if (!result && job.expiresAt - clock() < 1000) result = { state: 'cancelled', reason: 'expired_event' };
    if (!result) {
      let subscription, payload;
      try {
        subscription = validateSubscription(job.subscription);
        payload = buildPushPreview(job.record, { showPreview: job.showPreview });
      } catch { result = { state: 'failed', reason: 'invalid_input' }; }
      if (!result) {
        try {
          const response = await transport.send(subscription, payload, {
            ttl: Math.max(0, Math.min(3600, Math.floor((job.expiresAt - clock()) / 1000))),
          });
          result = deliveryOutcome(response?.status, job.attempt, clock());
        } catch { result = deliveryOutcome(null, job.attempt, clock()); }
      }
    }
  }
  if (result.state === 'retry' && result.retryAt >= job.expiresAt) result = { state: 'cancelled', reason: 'expired_before_retry' };
  if (result.state === 'expired_subscription') await store.expire(job.subscriptionId, job.leaseToken);
  await store.finish(job.id, job.leaseToken, result);
  return result;
}
