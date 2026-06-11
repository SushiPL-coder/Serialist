# Changelog

All notable changes to Serialist are documented here.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.3.0] – 2026-06-11

### Added
- **PWA install banner** – iOS (Share → Add to Home Screen) and Android/Chrome native prompt
- **SW auto-update bar** – "New version available!" bar with one-click reload when a new Service Worker is waiting
- **iOS pinch-zoom prevention** – JS `touchmove` listener blocks multi-touch zoom (iOS ignores `user-scalable=no`)
- **Data export / import** – JSON backup/restore in Settings; critical for iOS where deleting the PWA wipes all local data
- **`applyUpdate()` / `dismissInstallBanner()`** public functions wired to UI

### Fixed
- **Desktop phone frame too narrow** – explicit `width: min(430px, …)` on `#app` in desktop media query
- **Modals full-screen on desktop** – `.overlay` switched to `position: absolute` inside `#app` at `≥520px`
- **"jutro" label on all future notifications** – now correctly shows "dziś" / "jutro" / "za N dni"
- **Overscroll pull-down on empty content** – `overscroll-behavior: contain` on `.main`
- **`touch-action: manipulation`** added to `html, body` to block double-tap zoom
- **SW cache bumped** to `serialist-v2` so deployed changes actually reach users

---

## [0.2.0] – 2026-06-10

### Added
- **SkyShowtime** and **Canal+** platforms with colors and cover gradients
- **Episodes per release** (`releaseCount` field) – support for Netflix full-season drops and multi-episode weekly releases (e.g. 2 eps/week)
- **TMDB client-side fallback** – if the Cloudflare Worker has no `TMDB_API_KEY`, the app tries a direct TMDB call using the key stored in Settings
- **TMDB settings label** updated to "API Read Access Token" with instructions

### Fixed
- **iOS keyboard crash** – removed `overflow: hidden` from `body` which was blocking the iOS keyboard from repositioning the viewport when a form input was focused
- **Desktop centering** – `min-height: 100dvh` → `height: 100dvh` ensures flex centering works in all browsers
- **Desktop background** – centered radial gradient instead of plain black
- **Third nav tab ("DO OBEJRZENIA") truncated** – reduced `.ni` padding from 20px to 10px; added `flex: 1` for equal tab distribution
- **`episodesPerSeason` divide-by-zero guard** – `Math.max(1, epsPerS)` prevents `NaN` / `-Infinity` labels

---

## [0.1.0] – 2026-06-08

### Added
- Weekly, interval ("Co X dni"), and manual episode schedules
- TMDB cover search via Cloudflare Pages Function proxy
- Custom cover upload (base64 stored in IndexedDB)
- Episode watch/unwatch tracking with S01E01 label generation
- "Do nadrobienia" backlog – 30-day look-back for unwatched episodes
- Watchlist tab for upcoming seasons
- VAPID push notifications via Cloudflare Worker + KV
- Day-strip calendar (week view) with dot indicators
- Detail view per series with full episode list
- Settings: TMDB key, VAPID key, push toggle
- Service Worker for offline support (cache-first static, network-first API)
- PWA manifest, icons, apple-touch-icon
- Dark theme with purple/violet accent (`--a: #7C6BFE`)
- Platforms: Netflix, HBO Max, Disney+, Prime, Apple TV+, Hulu, YouTube, Inne
