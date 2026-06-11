// functions/api/config.js
// Public app configuration. The VAPID *public* key is, by definition, public —
// serving it here means users never have to paste it manually.

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
    authEnabled:    !!(env.AUTH_USERS && env.AUTH_SECRET),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
