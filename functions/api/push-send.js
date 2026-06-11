// functions/api/push-send.js
// Sends Web Push notifications for episodes airing within the next hour.
//
// Cloudflare Pages has NO cron triggers, so this is a normal Pages Function
// triggered by an external cron (e.g. cron-job.org) once per hour:
//
//   GET /api/push-send?secret=YOUR_CRON_SECRET
//
// Reads the per-user episode schedule from D1 (uploaded by the app during
// sync) and sends a properly encrypted aes128gcm push to every device of
// that user. Implements RFC 8291 (aes128gcm) + RFC 8292 (VAPID) with pure
// Web Crypto — no npm dependencies.
//
// Requires: D1 binding `DB`, env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//           VAPID_SUBJECT, CRON_SECRET.
//
// NOTE on keys: VAPID_PRIVATE_KEY must be the *raw* base64url private key
// (43 chars) generated together with VAPID_PUBLIC_KEY as a pair, e.g. by
// `npx web-push generate-vapid-keys`. A mismatched or PKCS8 key will fail.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.CRON_SECRET || url.searchParams.get('secret') !== env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys not configured' }, 500);
  }

  const result = await sendDueNotifications(env, url.searchParams.has('test'));
  return json({ ok: true, ...result });
}

async function sendDueNotifications(env, testMode) {
  const now = Date.now();
  const log = { checked: 0, sent: 0, removedSubs: 0, errors: [] };

  // Candidate rows: today and yesterday (covers timezone edges), not yet notified
  const d  = t => new Date(t).toISOString().slice(0, 10);
  const rows = await env.DB.prepare(
    'SELECT rowid, * FROM schedule WHERE notified = 0 AND date IN (?, ?, ?)'
  ).bind(d(now - 86400000), d(now), d(now + 86400000)).all();

  for (const r of rows.results || []) {
    log.checked++;
    // Air time in UTC: parse local date+time as if UTC, then apply tz offset
    // (tz_offset = Date.getTimezoneOffset() → UTC = local + offset minutes)
    const airUtc = new Date(`${r.date}T${r.time || '20:00'}:00Z`).getTime()
                 + (r.tz_offset || 0) * 60000;

    if (!testMode) {
      if (airUtc > now + 60 * 60000) continue;            // more than 1h away — wait
      if (airUtc < now - 6 * 3600000) {                   // stale (>6h ago) — skip silently
        await env.DB.prepare('UPDATE schedule SET notified = 1 WHERE rowid = ?').bind(r.rowid).run();
        continue;
      }
    }

    const subs = await env.DB.prepare(
      'SELECT key, subscription FROM push_subs WHERE user_id = ?'
    ).bind(r.user_id).all();

    const payload = {
      title: `📺 ${r.title}`,
      body:  `${r.label ? r.label + ' — ' : ''}premiera o ${r.time}!`,
      url:   '/',
      tag:   `serialist-${r.date}-${r.title}`.slice(0, 64),
    };

    for (const s of subs.results || []) {
      try {
        const status = await sendPush(env, JSON.parse(s.subscription), payload);
        if (status === 404 || status === 410) {
          await env.DB.prepare('DELETE FROM push_subs WHERE key = ?').bind(s.key).run();
          log.removedSubs++;
        } else if (status >= 200 && status < 300) {
          log.sent++;
        } else {
          log.errors.push(`push ${status} for ${r.title}`);
        }
      } catch (e) {
        log.errors.push(e.message);
      }
    }

    await env.DB.prepare('UPDATE schedule SET notified = 1 WHERE rowid = ?').bind(r.rowid).run();
  }

  return log;
}

// ══ Web Push: VAPID (RFC 8292) + aes128gcm (RFC 8291) ════════════════

async function sendPush(env, subscription, payloadObj) {
  const { endpoint, keys } = subscription;
  const jwt  = await buildVapidJwt(env, endpoint);
  const body = await encryptAes128Gcm(JSON.stringify(payloadObj), keys.p256dh, keys.auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type':     'application/octet-stream',
      'TTL':              '86400',
      'Urgency':          'normal',
    },
    body,
  });
  return res.status;
}

// VAPID JWT (ES256). Private key = raw 32-byte scalar (base64url),
// public key = raw 65-byte uncompressed point (base64url) → import as JWK.
async function buildVapidJwt(env, endpoint) {
  const u   = new URL(endpoint);
  const aud = `${u.protocol}//${u.host}`;

  const header = b64uFromStr(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64uFromStr(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  }));
  const unsigned = `${header}.${claims}`;

  const pub = b64uToBytes(env.VAPID_PUBLIC_KEY);          // 65 bytes: 0x04 || x || y
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY: invalid format');
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64uFromBytes(pub.slice(1, 33)),
    y: b64uFromBytes(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY.trim(),
  };
  const key = await crypto.subtle.importKey('jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(unsigned));

  return `${unsigned}.${b64uFromBytes(new Uint8Array(sig))}`;
}

// RFC 8291 content encryption
async function encryptAes128Gcm(plaintext, p256dhB64, authB64) {
  const uaPub = b64uToBytes(p256dhB64);                    // client public key (65)
  const auth  = b64uToBytes(authB64);                      // auth secret (16)
  const salt  = crypto.getRandomValues(new Uint8Array(16));

  // Ephemeral server ECDH key pair
  const asKeys  = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaKey   = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh    = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const asPub   = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  // IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0" || ua_pub || as_pub)
  const ikm   = await hkdf(auth, ecdh, concat(str('WebPush: info\0'), uaPub, asPub), 32);
  const cek   = await hkdf(salt, ikm, str('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, str('Content-Encoding: nonce\0'), 12);

  // Plaintext + padding delimiter 0x02 (last record)
  const data = concat(new TextEncoder().encode(plaintext), new Uint8Array([2]));
  const key  = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct   = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));

  // Header: salt(16) | rs(4 = 4096) | idlen(1 = 65) | as_pub(65) | ciphertext
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct).buffer;
}

async function hkdf(salt, ikm, info, length) {
  const key  = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// ── byte helpers ─────────────────────────────────────────────────────

function str(s)        { return new TextEncoder().encode(s); }
function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function b64uFromStr(s)   { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uFromBytes(b) { return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uToBytes(b64) {
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
