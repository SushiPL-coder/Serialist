# Changelog

All notable changes to Serialist are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

---

## [0.4.0] – 2026-06-11

### Added
- **Accounts + cloud sync (Cloudflare D1)** – optional login (accounts defined by the instance owner via `AUTH_USERS`). Logged-in users get automatic whole-state sync (last-write-wins, debounced 3 s after every change, plus on app focus / coming back online). Data survives PWA reinstall. Without login the app runs in **demo mode** – fully local, exactly as before.
- New endpoints: `POST /api/auth/login`, `GET|PUT /api/sync`, `GET /api/config` (serves the VAPID public key – no more manual pasting), `DELETE /api/push-subscribe`.
- `schema.sql` – D1 schema (state, covers, push_subs, schedule).
- Covers are synced in a separate D1 table and uploads are downscaled client-side to max 600 px JPEG (D1 row-size limits + lighter IndexedDB).
- Push notifications now send **real episode alerts**: the app uploads a 14-day episode schedule during sync; the cron sends a push up to 1 h before air time, per device, per user.

### Fixed
- **iOS keyboard covering inputs** – `visualViewport`-driven `--kb` CSS variable lifts the bottom-sheet modal above the keyboard and scrolls the focused field into view; added `viewport-fit=cover` + `interactive-widget=resizes-content`.
- **Push notifications never worked** – `push-send.js` used Worker module syntax (`export default { scheduled }`) which Cloudflare **Pages Functions never execute**, and its encryption mixed the legacy `aesgcm` HKDF scheme with the `aes128gcm` wire format (undecryptable), with a PKCS8 key import that fails for standard raw VAPID keys. Rewritten from scratch as a Pages Function (`GET /api/push-send?secret=…`, trigger hourly via external cron such as cron-job.org) with RFC 8291/8292-correct crypto, **verified against the official RFC 8291 test vector**. Expired subscriptions (404/410) are cleaned up automatically.
- Stale push subscriptions with a previous VAPID key are unsubscribed and re-created automatically.

### Changed
- Push subscriptions moved from KV to D1 (KV namespace no longer needed) and now require login (the cron needs the user's schedule to know what to send).
- Removed the manual "VAPID Public Key" field from Settings – fetched from `/api/config`.
- Settings now contain an **Account** section (login / logout / sync now / last-sync time).
- `wrangler.toml` rewritten as configuration documentation for the Pages dashboard.

---

## [0.3.1] – 2026-06-11

### Fixed
- **iOS scroll / zoom** – copied exact SolidOffer pattern:
  - `html { touch-action: manipulation }` – blocks double-tap zoom
  - `body { height: 100dvh; overflow: hidden }` – blocks all scroll outside `#app`
  - `#app { overflow: hidden }` – app container clips all overflow
  - `dvh` (dynamic viewport height) automatically shrinks when iOS keyboard appears → modal scrolls internally, no keyboard conflict
  - Removed JS `touchmove` listener (was interfering with modal scroll); replaced with `gesturestart`/`gesturechange` preventDefault for legacy Safari

---

## [0.3.0] – 2026-06-11

### Added
- **PWA install banner** – iOS (Share → Add to Home Screen) and Android/Chrome native prompt
- **SW auto-update bar** – "New version available!" with one-click reload
- **Data export / import** – JSON backup/restore in Settings with iOS data-loss warning
- **`gesturestart` zoom prevention** for legacy Safari

### Fixed
- **Desktop phone frame too narrow** – explicit `width: min(430px, …)` on `#app`
- **Modals full-screen on desktop** – `position: absolute` inside `#app` at ≥520px
- **"jutro" label on all future notifications** – now "dziś" / "jutro" / "za N dni"
- **Overscroll pull-down** – `overscroll-behavior: contain` on `.main`
- **SW cache bumped to v2** – forces update on all installed PWAs

---

## [0.2.0] – 2026-06-10

### Added
- SkyShowtime and Canal+ platforms
- Episodes per release (`releaseCount`) – Netflix full-season drops, 2 eps/week etc.
- TMDB client-side fallback using key from Settings

### Fixed
- iOS keyboard crash (removed premature `overflow: hidden` from body)
- Desktop centering (`height: 100dvh`)
- Third nav tab ("DO OBEJRZENIA") truncated on small screens
- `episodesPerSeason` divide-by-zero guard

---

## [0.1.0] – 2026-06-08

### Added
- Weekly / interval / manual episode schedules
- TMDB cover search, custom cover upload
- Watch tracking with S01E01 label generation
- 30-day backlog of unwatched episodes
- Watchlist tab for upcoming seasons
- VAPID push notifications via Cloudflare Worker + KV
- Day-strip calendar (week view)
- Service Worker for offline support
- PWA manifest, dark theme, platforms: Netflix / HBO Max / Disney+ / Prime / Apple TV+ / Hulu / YouTube
