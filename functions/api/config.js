// functions/api/config.js
// Public app configuration + self-diagnostics for the instance owner.
// The VAPID *public* key is, by definition, public. The `diag` flags only
// reveal WHETHER things are configured (booleans), never their values.

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    vapidPublicKey: (env.VAPID_PUBLIC_KEY || '').trim() || null,
    authEnabled:    !!(env.AUTH_USERS && env.AUTH_SECRET),
    diag: {
      d1_binding_DB:     !!env.DB,
      VAPID_PUBLIC_KEY:  !!env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT:     !!env.VAPID_SUBJECT,
      AUTH_SECRET:       !!env.AUTH_SECRET,
      AUTH_USERS:        !!env.AUTH_USERS,
      CRON_SECRET:       !!env.CRON_SECRET,
      TMDB_API_KEY:      !!env.TMDB_API_KEY,
    },
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',   // diagnostyka zawsze świeża (było max-age=300 → mylące)
    },
  });
}
