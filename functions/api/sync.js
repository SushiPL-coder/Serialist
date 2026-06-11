// functions/api/sync.js
// Cloud sync for logged-in users (Cloudflare D1, binding: DB).
//
//   GET  /api/sync   → { updatedAt, state | null }   (state includes covers re-attached)
//   PUT  /api/sync   ← { updatedAt, state, covers, schedule, tzOffset }
//
// Strategy: whole-state last-write-wins (simple & predictable for 1 user
// on a few devices). Covers live in a separate table to stay under D1
// row-size limits. `schedule` feeds the push-notification cron.

export async function onRequestGet({ request, env }) {
  const user = await authUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const row = await env.DB.prepare(
    'SELECT data, updated_at FROM state WHERE user_id = ?'
  ).bind(user).first();

  if (!row) return json({ updatedAt: 0, state: null });

  const state  = JSON.parse(row.data);
  const covers = await env.DB.prepare(
    'SELECT item_id, data FROM covers WHERE user_id = ?'
  ).bind(user).all();

  // Re-attach covers to series / watchlist items
  const map = {};
  (covers.results || []).forEach(c => { map[c.item_id] = c.data; });
  (state.series    || []).forEach(s => { if (map[s.id]) s.cover = map[s.id]; });
  (state.watchlist || []).forEach(w => { if (map[w.id]) w.cover = map[w.id]; });

  return json({ updatedAt: row.updated_at, state });
}

export async function onRequestPut({ request, env }) {
  const user = await authUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const state     = body.state || {};
  const covers    = Array.isArray(body.covers)   ? body.covers   : [];
  const schedule  = Array.isArray(body.schedule) ? body.schedule : [];
  const updatedAt = Number(body.updatedAt) || Date.now();
  const tzOffset  = Number.isFinite(body.tzOffset) ? body.tzOffset : 0;

  const stateJson = JSON.stringify(state);
  if (stateJson.length > 1_800_000) {
    return json({ error: 'State too large (covers should sync separately)' }, 413);
  }

  const stmts = [];

  // 1. State (upsert)
  stmts.push(env.DB.prepare(
    `INSERT INTO state (user_id, data, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id) DO UPDATE SET data = ?2, updated_at = ?3`
  ).bind(user, stateJson, updatedAt));

  // 2. Covers (replace all; skip anything near the D1 row limit)
  stmts.push(env.DB.prepare('DELETE FROM covers WHERE user_id = ?').bind(user));
  for (const c of covers) {
    if (!c?.id || typeof c.data !== 'string') continue;
    if (c.data.length > 1_800_000) continue;
    stmts.push(env.DB.prepare(
      'INSERT INTO covers (user_id, item_id, data) VALUES (?, ?, ?)'
    ).bind(user, c.id, c.data));
  }

  // 3. Schedule — preserve already-sent notification flags across re-uploads
  const sentRows = await env.DB.prepare(
    'SELECT date, time, title FROM schedule WHERE user_id = ? AND notified = 1'
  ).bind(user).all();
  const sentSet = new Set((sentRows.results || []).map(r => `${r.date}|${r.time}|${r.title}`));

  stmts.push(env.DB.prepare('DELETE FROM schedule WHERE user_id = ?').bind(user));
  for (const s of schedule.slice(0, 500)) {
    if (!s?.date || !s?.title) continue;
    const time = s.time || '20:00';
    const wasSent = sentSet.has(`${s.date}|${time}|${s.title}`) ? 1 : 0;
    stmts.push(env.DB.prepare(
      `INSERT INTO schedule (user_id, date, time, title, label, tz_offset, notified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(user, s.date, time, String(s.title).slice(0, 200), String(s.label || '').slice(0, 100), tzOffset, wasSent));
  }

  await env.DB.batch(stmts);
  return json({ ok: true, updatedAt });
}

// ── auth helper (HS256 JWT, secret = AUTH_SECRET) ────────────────────

async function authUser(request, env) {
  if (!env.AUTH_SECRET) return null;
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const parts = token.split('.');
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
