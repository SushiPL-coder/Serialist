// functions/api/push-subscribe.js
// Saves / removes a Web Push subscription in D1, tied to the logged-in user.
// (Login required — the cron needs the user's episode schedule to know
//  what to send, so anonymous subscriptions would be useless.)
//
//   POST   /api/push-subscribe   { subscription }   → { ok }
//   DELETE /api/push-subscribe   { endpoint }       → { ok }

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" is not configured — add it in Pages → Settings → Bindings and redeploy' }, 503);
  const user = await authUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return json({ error: 'Invalid subscription' }, 400);
  }

  const key = await sha256(sub.endpoint);
  await env.DB.prepare(
    `INSERT INTO push_subs (key, user_id, subscription, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(key) DO UPDATE SET user_id = ?2, subscription = ?3, updated_at = ?4`
  ).bind(key, user, JSON.stringify(sub), new Date().toISOString()).run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" is not configured — add it in Pages → Settings → Bindings and redeploy' }, 503);
  const user = await authUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!body.endpoint) return json({ error: 'Missing endpoint' }, 400);

  const key = await sha256(body.endpoint);
  await env.DB.prepare('DELETE FROM push_subs WHERE key = ? AND user_id = ?')
    .bind(key, user).run();

  return json({ ok: true });
}

// ── helpers ──────────────────────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authUser(request, env) {
  if (!env.AUTH_SECRET) return null;
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const parts = h.slice(7).split('.');
  if (parts.length !== 3) return null;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = b64uToBytes(parts[2]);
  const ok  = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;

  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))));
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload.sub;
  } catch { return null; }
}

function b64uToBytes(b64) {
  const pad = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
