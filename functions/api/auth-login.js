// functions/api/auth-login.js
// POST /api/auth-login  { username, password } → { token, username }
//
// Accounts are defined in the AUTH_USERS environment variable (Secret):
//   format:  user1:password1;user2:password2
// Tokens are HS256 JWTs signed with AUTH_SECRET (any long random string).
// There is NO open registration on purpose — the public site is a demo,
// accounts exist only for the instance owner(s).

const TOKEN_DAYS = 90;

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_USERS || !env.AUTH_SECRET) {
    return json({ error: 'Auth is not configured on this instance' }, 501);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json({ error: 'Missing credentials' }, 400);

  // Parse AUTH_USERS: "user:pass;user2:pass2" (also accepts newlines/commas)
  const users = {};
  env.AUTH_USERS.split(/[;\n,]+/).forEach(pair => {
    const i = pair.indexOf(':');
    if (i > 0) users[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  });

  const expected = users[username];
  const ok = expected && await constantTimeEqual(expected, password);
  if (!ok) return json({ error: 'Nieprawidłowy login lub hasło' }, 401);

  const exp   = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  const token = await signJwt({ sub: username, exp }, env.AUTH_SECRET);
  return json({ token, username, exp });
}

// ── helpers ──────────────────────────────────────────────────────────

async function signJwt(payload, secret) {
  const enc      = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${enc(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${unsigned}.${sigB64}`;
}

// Avoid trivially leaking password length differences via timing
async function constantTimeEqual(a, b) {
  const ha = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a));
  const hb = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b));
  const ua = new Uint8Array(ha), ub = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
