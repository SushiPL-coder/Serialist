# Changelog

All notable changes to Serialist are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

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
