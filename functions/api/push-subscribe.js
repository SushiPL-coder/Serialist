// functions/api/push-subscribe.js
// Saves a Web Push subscription to Cloudflare KV
// KV namespace: PUSH_SUBS (bind in wrangler.toml / Pages settings)

export async function onRequest(ctx) {
  const { request, env } = ctx;

  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST')    return new Response('Method Not Allowed', { status: 405 });

  try {
    const { subscription } = await request.json();
    if (!subscription?.endpoint) return new Response('Invalid subscription', { status: 400 });

    // Use endpoint hash as key (stable per device/browser)
    const key = await sha256(subscription.endpoint);
    await env.PUSH_SUBS.put(key, JSON.stringify(subscription), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year
    });

    return new Response(JSON.stringify({ ok: true, key }), {
      headers: corsHeaders(),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders(),
    });
  }
}

async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function corsHeaders() {
  return {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  };
}

function cors() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
