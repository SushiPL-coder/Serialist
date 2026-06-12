// functions/api/config.js
// Public app configuration + self-diagnostics for the instance owner.
// `vapid_pair_ok` cryptographically proves whether VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY belong to the same key pair (sign + verify round-trip).

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    vapidPublicKey: (env.VAPID_PUBLIC_KEY || '').trim() || null,
    authEnabled:    !!(env.AUTH_USERS && env.AUTH_SECRET),
    diag: {
      d1_binding_DB:     !!env.DB,
      VAPID_PUBLIC_KEY:  !!env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!env.VAPID_PRIVATE_KEY,
      vapid_pair_ok:     await vapidPairOk(env),
      VAPID_SUBJECT:     !!env.VAPID_SUBJECT,
      AUTH_SECRET:       !!env.AUTH_SECRET,
      AUTH_USERS:        !!env.AUTH_USERS,
      CRON_SECRET:       !!env.CRON_SECRET,
      TMDB_API_KEY:      !!env.TMDB_API_KEY,
    },
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function vapidPairOk(env) {
  try {
    const pubB = b64uToBytes((env.VAPID_PUBLIC_KEY || '').trim());
    if (pubB.length !== 65 || pubB[0] !== 4) return false;
    const b64u = a => btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwkPriv = {
      kty: 'EC', crv: 'P-256',
      x: b64u(pubB.slice(1, 33)), y: b64u(pubB.slice(33, 65)),
      d: (env.VAPID_PRIVATE_KEY || '').trim(),
    };
    const priv = await crypto.subtle.importKey('jwk', jwkPriv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const pub  = await crypto.subtle.importKey('raw', pubB,    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const data = new TextEncoder().encode('serialist-vapid-selftest');
    const sig  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, data);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, data);
  } catch {
    return false;  // niespójna para potrafi też rzucić wyjątkiem przy imporcie
  }
}

function b64uToBytes(b64) {
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}
