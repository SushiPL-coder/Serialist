# Changelog

All notable changes to Serialist are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

---

## [0.5.1] – 2026-06-13

### Fixed
- **KRYTYCZNE: odhaczanie odcinków całkowicie nie działało** – v0.5.0 wprowadziło drugą funkcję `toggleWatched(id)` (dla filmów w watchliście), która w JS nadpisała istniejącą `toggleWatched(seriesId, dateStr)` używaną przez kalendarz i „Do nadrobienia”. Kliknięcie ✓ wywoływało wersję dla watchlisty (zwracała `undefined` dla ID serialu) – stąd zero efektu wizualnego i komunikat „Oznaczono jako nieobejrzane” przy każdym kliknięciu. Funkcja dla filmów przemianowana na `toggleWlWatched`.
- **Wybór okładki z TMDB w watchliście trafiał w zły podgląd** – `pickTMDB` zawsze pisał do `S.coverB64` / podglądu modala seriali, niezależnie od tego, który modal był otwarty. Teraz rozróżnia kontener wyników (`wl-tmdb-results` → `S.wlCoverB64` + podgląd watchlisty).
- **Dzwonek zawsze miał czerwoną kropkę** – `renderNotifPanel` zapalał wskaźnik, gdy cokolwiek nadchodziło w ciągu 7 dni (czyli praktycznie zawsze). Kropka pojawia się teraz tylko gdy coś nadejdzie w ciągu 24h.
- **Emoji 📺 w tytule powiadomienia push** – usunięte (notyfikacja i tak ma ikonę aplikacji); ikona/badge w Service Workerze przełączone z SVG na PNG (`icon-192.png`) dla szerszej zgodności z systemowymi powiadomieniami Android/iOS.
- **Etykieta „30 min przed emisją”** była martwym tekstem z wcześniejszej wersji – realna logika crona wysyła do godziny przed emisją (zależnie od częstotliwości zewnętrznego crona). Etykieta zmieniona na „Do godziny przed emisją”. Dla węższego okna ustaw cron na cron-job.org na np. co 15 min – pierwsze trafienie w okno ≤60 min wypadnie wtedy bliżej 45–60 min przed, a nie dokładnie w momencie premiery.

### Added
- **Własna okładka w watchliście** (Serial i Film) – ten sam upload/podgląd/usuwanie co w modalu seriali (max 8 MB, skalowane do 600 px JPEG), niezależny stan `S.wlCoverB64`.

### Changed
- Service worker cache bumped to `serialist-v7`.

---

## [0.5.0] – 2026-06-13

### Added
- **Filmy w watchliście** – nowy typ wpisu „Film" (przełącznik Serial/Film w modalu „Dodaj do listy"): opcjonalna data premiery, checkbox „Już obejrzany" (karta szarzeje + zielona odznaka „✓ Obejrzane", kliknięcie ikony na kafelku przełącza status) i toggle „Powiadom o premierze" – jednorazowy push w dniu premiery (do 14 dni), bez powtarzania jak przy odcinkach seriali.
- **Klucz TMDB w synchronizacji** – po zalogowaniu klucz wpisany w Ustawieniach jedzie do D1 razem z resztą stanu (bez zmian w schemacie – w polu `state.settings`); na innym zalogowanym urządzeniu z pustym polem klucz uzupełni się automatycznie po synchronizacji.

### Fixed
- **Pole okładki zawsze widoczne / stara okładka nie czyściła się** – `.cover-preview { display: inline-flex }` miało wyższy priorytet niż atrybut `[hidden]` (ten sam poziom specyficzności, ale UA-stylesheet `[hidden]` przegrywa z każdą regułą autorską) – podgląd okładki był renderowany cały czas, a po dodaniu drugiego serialu zostawał `src` poprzedniego obrazka. Dodano `.cover-preview[hidden] { display: none }` i czyszczenie `src` w `hideCoverPreview()`.
- **Losowe przeładowania PWA przy przełączaniu kart** – globalny listener `controllerchange` przeładowywał całą aplikację przy KAŻDEJ aktywacji nowego Service Workera (np. przy powrocie do karty po deployu), bez ostrzeżenia. Reload następuje teraz tylko po kliknięciu „Odśwież” w banerze aktualizacji.
- **Dodany serial nie pojawiał się w kalendarzu bez restartu aplikacji** – `switchTab()` teraz re-renderuje docelową zakładkę (kalendarz/seriale/watchlista) z aktualnego stanu przy każdym przejściu, jako siatka bezpieczeństwa niezależna od ścieżki zapisu.

### Changed
- Service worker cache bumped to `serialist-v6`.

---

## [0.4.1] – 2026-06-11

### Fixed
- **Login returned 405** – the nested `functions/api/auth/login.js` folder was easy to lose when uploading via the GitHub web UI (POST then hit a static asset → 405). The endpoint is now a flat file: `functions/api/auth-login.js` → `POST /api/auth-login`.
- **Modals impossible to dismiss on tall phones** – the bottom sheet could fill nearly the whole screen, leaving only a sliver of backdrop under the iOS status bar. Every modal now has a sticky ✕ close button, and tapping the drag handle also closes it.
- **iOS install banner never reappearing** – the "dismissed" flag was permanent (and survived in Safari localStorage across PWA reinstalls). It now expires after 14 days; the legacy flag value is treated as expired.

### Changed
- README restored to the original single-file bilingual layout (logo header, badges, nav links) with v0.4.x content; `README.pl.md` removed.
- Service worker cache bumped to `serialist-v4`.

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
