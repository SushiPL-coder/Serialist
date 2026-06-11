# 📺 Serialist

**Open-source TV series & YouTube release tracker — installable PWA.**

Track weekly shows, interval-based releases and manual air dates, tick off watched episodes, keep a catch-up backlog and a watchlist of upcoming premieres. Built with Vanilla JS, IndexedDB and Cloudflare Pages — no frameworks, no build step.

🇵🇱 [Wersja polska README](README.pl.md)

---

## ✨ Try the demo

**https://serialist.pages.dev**

The public site runs in **demo mode**: everything is stored locally on your device (IndexedDB), nothing is sent anywhere. To enable TMDB poster/title search in the demo, paste your own free TMDB **API Read Access Token** in *Settings* (themoviedb.org → Settings → API).

> ⚠️ Demo mode = local data only. On iOS, deleting the PWA from the home screen deletes its data. Use *Settings → Export JSON* for backups — or self-host with accounts and cloud sync (below).

Login, cloud sync and push notifications are reserved for accounts created by the instance owner. Want them for yourself? **Self-host your own instance — it's free** (Cloudflare free tier) and takes ~15 minutes.

---

## 🚀 Features

- 📅 **Week calendar** with day strip, episode cards and watch toggles
- 🔁 **Three schedule types**: weekly (pick days), interval (every N days), manual dates
- 🧮 Automatic episode numbering (S/E), multi-episode drops, season lengths
- 🕳️ **Backlog** — missed episodes from the last 30 days
- 🔖 **Watchlist** for upcoming premieres with release countdown
- 🔍 **TMDB search** — titles + posters (server-side key or your own)
- ☁️ **Optional cloud sync** (Cloudflare D1) — data survives reinstall, syncs across devices
- 🔔 **Web Push** — notification up to 1 h before an episode airs (RFC 8291/8292, works on iOS 16.4+)
- 📱 Installable PWA, offline-first, iOS & Android friendly (incl. keyboard-aware bottom sheets)
- 🆓 100% free to run: Cloudflare Pages + Functions + D1 free tier

---

## 🛠️ Self-hosting (full setup)

Everything runs on Cloudflare's free tier. No CLI required — dashboard only.

### 1. Deploy to Cloudflare Pages

1. Fork this repository.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick your fork.
3. Build settings: no framework, **build output directory: `public`**. Deploy.

The app already works in demo mode at this point.

### 2. Create the D1 database (accounts + sync + push)

1. Dashboard → **Storage & Databases → D1 → Create** → name: `serialist-db`.
2. Open the database → **Console** → paste the contents of [`schema.sql`](schema.sql) → Execute.
3. Pages project → **Settings → Bindings → Add → D1 database**:
   - Variable name: `DB`
   - Database: `serialist-db`

### 3. Configure variables

Pages project → **Settings → Variables and secrets** (Production):

| Name | Type | Value |
|---|---|---|
| `AUTH_SECRET` | Secret | Long random string (40+ chars) — signs login tokens |
| `AUTH_USERS` | Secret | Accounts: `alice:Str0ngPass;bob:OtherPass` |
| `VAPID_PUBLIC_KEY` | Plaintext | From `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Secret | From the **same** generated pair |
| `VAPID_SUBJECT` | Secret | `mailto:you@example.com` |
| `CRON_SECRET` | Secret | Random string protecting `/api/push-send` |
| `TMDB_API_KEY` | Secret | *(optional)* TMDB Read Access Token for server-side search |

Generate VAPID keys locally with:

```bash
npx web-push generate-vapid-keys
```

> ⚠️ The two VAPID keys **must come from the same generated pair**, and the private key must be the raw base64url form printed by web-push (≈43 chars). If you ever rotate the keys, every device must re-enable notifications (iOS: remove the PWA, reboot, reinstall, log in, enable push again).

**Redeploy** the project after adding bindings/variables (Deployments → Redeploy).

### 4. Hourly push cron

Cloudflare Pages has no built-in cron, so use a free external cron such as [cron-job.org](https://cron-job.org):

- URL: `https://YOUR-PROJECT.pages.dev/api/push-send?secret=YOUR_CRON_SECRET`
- Schedule: **every hour** (e.g. minute 0)
- Method: GET

The endpoint returns JSON (`{"ok":true,"checked":…,"sent":…}`) you can use for monitoring.

### 5. Use it

1. Open your instance → **Settings → Account** → log in with a user from `AUTH_USERS`.
2. Your data now syncs to D1 automatically (3 s after every change, on focus, on reconnect). Reinstalling the PWA no longer loses anything — just log in again.
3. (iOS) Install the PWA: Share → *Add to Home Screen*, open it from the icon, then **Settings → Enable notifications**. Push requires iOS 16.4+ and the installed PWA.
4. Enable the 🔔 bell on each series you want alerts for.

---

## 🧱 Architecture

```
public/                  Vanilla JS PWA (IndexedDB = primary store, offline-first)
functions/api/
  config.js              GET  /api/config          public VAPID key + capabilities
  auth/login.js          POST /api/auth/login      AUTH_USERS check → HS256 JWT (90 days)
  sync.js                GET/PUT /api/sync         whole-state LWW sync to D1; covers in a
                                                   separate table; uploads 14-day episode schedule
  push-subscribe.js      POST/DELETE               per-user push subscriptions (D1)
  push-send.js           GET /api/push-send        cron endpoint; RFC 8291 aes128gcm +
                                                   RFC 8292 VAPID, pure Web Crypto, no deps
schema.sql               D1 schema
```

**Sync model:** the client keeps a `lastChange` timestamp; on startup it pulls the server state and the newer side wins (whole-state last-write-wins). Simple, predictable, ideal for one user on a few devices. Demo mode (not logged in) never touches the network for data.

**Push pipeline:** during every sync the client uploads the next 14 days of episodes (for series with 🔔 enabled) including the device's timezone offset → the hourly cron picks entries airing within the next 60 minutes → encrypts a payload per device subscription → marks the entry as notified. Expired subscriptions (HTTP 404/410) are removed automatically.

The push encryption is implemented from scratch on Web Crypto and verified against the official RFC 8291 Appendix A test vector.

---

## 🔒 Security & privacy notes

- No open registration: accounts exist only in `AUTH_USERS`. The demo never stores anything server-side.
- Login issues an HMAC-SHA256 (HS256) token valid 90 days; data endpoints require it.
- A TMDB token entered in demo mode stays in local IndexedDB only.
- Covers are recompressed client-side (max 600 px JPEG) before storage/sync.

## 📄 License

MIT — see [LICENSE](LICENSE). Created by **SushiPL-coder**.
