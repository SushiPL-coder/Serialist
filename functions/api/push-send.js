// functions/api/push-send.js
// Cron trigger: sends push notifications for episodes airing soon
// Schedule in wrangler.toml: "0 * * * *" (every hour)
// Requires: PUSH_SUBS (KV), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

// NOTE: This Worker uses the web-push-js compatible VAPID signing.
// For full production use, deploy as a standalone Cloudflare Worker
// (not a Pages Function) so you can use wrangler.toml cron triggers.

export default {
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDueNotifications(env));
  },

  // HTTP trigger for testing: GET /api/push-send?secret=YOUR_SECRET
  async fetch(request, env) {
    const url    = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });
    await sendDueNotifications(env);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function sendDueNotifications(env) {
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // List all subscriptions
  const keys = await env.PUSH_SUBS.list();
  if (!keys.keys.length) return;

  // For each subscription, check due episodes
  // In a real setup you'd also store user schedules in KV/D1.
  // Here we just send a generic reminder — extend to store series per user.
  for (const keyObj of keys.keys) {
    try {
      const subStr = await env.PUSH_SUBS.get(keyObj.name);
      if (!subStr) continue;
      const sub = JSON.parse(subStr);
      await sendPush(env, sub, {
        title: 'Serialist',
        body:  'Sprawdź nadchodzące odcinki!',
        url:   '/',
        tag:   'serialist-reminder',
      });
    } catch (e) {
      console.error('Push send error:', e.message);
    }
  }
}

// ── Minimal VAPID-signed Web Push (no npm, pure Web Crypto) ──────────
async function sendPush(env, subscription, payload) {
  const { endpoint, keys } = subscription;
  const { p256dh, auth }   = keys;

  const vapidPublic  = env.VAPID_PUBLIC_KEY;
  const vapidPrivate = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@example.com';

  const audienceUrl = new URL(endpoint);
  const audience    = `${audienceUrl.protocol}//${audienceUrl.host}`;
  const expiry      = Math.floor(Date.now() / 1000) + 43200; // 12h

  // Build VAPID JWT
  const header  = urlsafeBase64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims  = urlsafeBase64(JSON.stringify({ aud: audience, exp: expiry, sub: vapidSubject }));
  const toSign  = `${header}.${claims}`;

  const privKey = await importVapidPrivateKey(vapidPrivate);
  const sig     = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(toSign));
  const jwt     = `${toSign}.${urlsafeBase64Buf(sig)}`;

  // Encrypt payload
  const encrypted = await encryptPayload(payload, p256dh, auth);

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/octet-stream',
      'Content-Length': encrypted.byteLength.toString(),
      'TTL':            '86400',
      'Authorization':  `vapid t=${jwt},k=${vapidPublic}`,
      'Content-Encoding': 'aes128gcm',
    },
    body: encrypted,
  });
}

async function importVapidPrivateKey(b64) {
  const raw = base64ToUint8(b64);
  return crypto.subtle.importKey('pkcs8', raw,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function encryptPayload(payload, p256dhB64, authB64) {
  const payloadStr = JSON.stringify(payload);
  const salt       = crypto.getRandomValues(new Uint8Array(16));

  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPub  = await crypto.subtle.importKey('raw', base64ToUint8(p256dhB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, serverKeys.privateKey, 256);
  const authBuf    = base64ToUint8(authB64);

  // HKDF to derive content encryption key and nonce
  const prk  = await hkdf(authBuf, new Uint8Array(sharedBits), new TextEncoder().encode('Content-Encoding: auth\0'), 32);
  const cek  = await hkdf(salt,    prk, buildInfo('aesgcm', await exportKey(serverKeys.publicKey), base64ToUint8(p256dhB64)), 16);
  const nonce = await hkdf(salt,   prk, buildInfo('nonce',  await exportKey(serverKeys.publicKey), base64ToUint8(p256dhB64)), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct     = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey,
    new TextEncoder().encode('\x00\x00' + payloadStr)); // padding header

  // Build aes128gcm record
  const serverPubRaw = await exportKey(serverKeys.publicKey);
  const result = new Uint8Array(salt.length + 4 + 1 + serverPubRaw.length + ct.byteLength);
  let offset = 0;
  result.set(salt,          offset); offset += salt.length;
  result.set([0,0,16,0],    offset); offset += 4; // rs=4096
  result.set([serverPubRaw.length], offset); offset += 1;
  result.set(serverPubRaw,  offset); offset += serverPubRaw.length;
  result.set(new Uint8Array(ct), offset);

  return result.buffer;
}

async function hkdf(salt, ikm, info, length) {
  const key    = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function exportKey(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

function buildInfo(type, clientPub, serverPub) {
  const enc = new TextEncoder();
  const prefix = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
  const buf = new Uint8Array(prefix.length + 2 + clientPub.length + 2 + serverPub.length);
  let o = 0;
  buf.set(prefix, o);        o += prefix.length;
  buf[o++] = 0; buf[o++] = clientPub.length;
  buf.set(clientPub, o);     o += clientPub.length;
  buf[o++] = 0; buf[o++] = serverPub.length;
  buf.set(serverPub, o);
  return buf;
}

function urlsafeBase64(str) {
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function urlsafeBase64Buf(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64ToUint8(b64) {
  const pad = b64.replace(/-/g,'+').replace(/_/g,'/') + '===='.slice((b64.length % 4) || 4);
  return Uint8Array.from(atob(pad).split('').map(c => c.charCodeAt(0)));
}
