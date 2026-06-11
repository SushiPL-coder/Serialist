<div align="center">
  <img src="public/icons/icon-192.svg" width="80" alt="Serialist icon">

  <h1>Serialist</h1>

  <p>Twój osobisty tracker seriali TV i kanałów YouTube.<br>
  Kalendarz tygodniowy · Śledzenie obejrzanych odcinków · Synchronizacja w chmurze · Push notifications · TMDB</p>

  <p>
    <a href="#demo">Demo</a> ·
    <a href="#instalacja-self-hosting">Instalacja</a> ·
    <a href="#konfiguracja">Konfiguracja</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>

  <img src="https://img.shields.io/github/license/SushiPL-coder/Serialist?style=flat-square&color=7C6BFE" alt="MIT License">
  <img src="https://img.shields.io/badge/PWA-ready-7C6BFE?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Cloudflare-Pages%20%2B%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages + D1">
  <img src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
</div>

---

> 🇬🇧 [English version below](#english) · 🇵🇱 Polska wersja poniżej

---

## O aplikacji

Serialist to aplikacja dla wszystkich, którzy śledzą wiele seriali TV lub kanałów YouTube jednocześnie i chcą mieć to wszystko pod kontrolą — bez zapisków w notatniku, bez przekopywania historii oglądania.

Dodajesz seriale, które oglądasz lub chcesz obejrzeć. Określasz harmonogram emisji. Aplikacja pokazuje Ci w kalendarzu tygodniowym kiedy wychodzą nowe odcinki, zaznaczasz co już widziałeś, a lista "do nadrobienia" zbiera wszystko, co Ci umknęło. Powiadomienia push przypomną Ci do godziny przed emisją — żebyś nie przegapił premiery.

**Tryb demo (bez logowania):** wszystkie dane zostają na Twoim urządzeniu (IndexedDB) — zero kont, zero chmury. Tak działa publiczna instancja [serialist.pages.dev](https://serialist.pages.dev).

**Tryb z kontem (self-hosting):** opcjonalne logowanie włącza automatyczną synchronizację z Cloudflare D1 — dane przeżywają reinstalację PWA i synchronizują się między urządzeniami, a serwer wysyła prawdziwe powiadomienia o konkretnych odcinkach. Konta zakłada właściciel instancji (brak otwartej rejestracji).

## Funkcje

- **Kalendarz tygodniowy** — widok 7 dni z kolorowymi oznaczeniami platform
- **Śledzenie obejrzanych** — zaznaczaj odcinki jako obejrzane, śledź postęp sezonu
- **Do nadrobienia** — automatyczna lista odcinków, które przegapiłeś (30 dni wstecz)
- **YouTube support** — harmonogram "co X dni" idealny dla kanałów YT
- **TMDB integration** — wyszukaj serial, pobierz okładkę automatycznie
- **Synchronizacja w chmurze** *(opcjonalna)* — Cloudflare D1, last-write-wins, auto-sync 3 s po każdej zmianie
- **Push notifications** — powiadomienie do godziny przed emisją konkretnego odcinka (działa też na iOS 16.4+)
- **PWA** — instalujesz jak aplikację, działa offline, klawiatura nie zasłania pól
- **Watchlist** — osobna zakładka na seriale do obejrzenia w przyszłości
- **Eksport / import JSON** — pełna kontrola nad danymi

## Stos technologiczny

| Warstwa   | Technologia               | Licencja  |
|-----------|---------------------------|-----------|
| Frontend  | Vanilla JS + Web APIs     | —         |
| CSS       | Custom CSS, system fonts  | —         |
| Ikony     | Lucide Icons (inline SVG) | MIT       |
| Fonty     | Outfit via Bunny Fonts    | OFL       |
| Hosting   | Cloudflare Pages          | Free tier |
| API       | Cloudflare Pages Functions| —         |
| Baza      | Cloudflare D1 (SQLite)    | Free tier |
| Push      | Web Push API + VAPID (RFC 8291/8292) | — |
| Okładki   | TMDB API                  | ToS       |
| Storage   | IndexedDB (native)        | —         |

Żadnych frameworków JS. Żadnych bundlerów. Żadnych node_modules w runtime. Szyfrowanie push napisane od zera na Web Crypto, zweryfikowane na wektorze testowym z RFC 8291.

---

## Demo

```
https://serialist.pages.dev
```

Publiczna instancja działa w trybie demo — dane tylko lokalnie na Twoim urządzeniu. Aby działało wyszukiwanie TMDB, wklej w *Ustawieniach* własny darmowy **API Read Access Token** ([themoviedb.org](https://www.themoviedb.org) → Settings → API). Logowanie, synchronizacja i push są dostępne na własnej instancji (niżej).

---

## Instalacja (self-hosting)

### Wymagania

- Konto Cloudflare (darmowe)
- Konto GitHub
- Przeglądarka — to wszystko, klucze VAPID wygenerujesz w konsoli F12 (bez Node.js)

### 1. Fork i deploy na Cloudflare Pages

1. Zrób fork tego repozytorium
2. **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**
3. Build settings:
   - Framework preset: `None`
   - Build command: *(puste)*
   - Build output directory: `public`
4. **Save and Deploy** — aplikacja działa już w trybie demo

### 2. Baza D1 (konta + synchronizacja + push)

1. Dashboard → **Storage & Databases → D1 → Create** → nazwa: `serialist-db`
2. Otwórz bazę → **Console** → wklej całą zawartość [`schema.sql`](schema.sql) → **Execute**
3. Projekt Pages → **Settings → Bindings → Add → D1 database**:
   - Variable name: `DB`
   - Database: `serialist-db`

---

## Konfiguracja

### Generowanie kluczy i sekretów (w przeglądarce, bez Node)

Otwórz konsolę przeglądarki (F12 → Console) i wklej:

```js
(async () => {
  const kp  = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const b64u = a => btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  console.log('VAPID_PUBLIC_KEY: ', b64u(pub));
  console.log('VAPID_PRIVATE_KEY:', jwk.d);
  console.log('CRON_SECRET:      ', rand(24));
  console.log('AUTH_SECRET:      ', rand(48));
})();
```

(Możesz też klasycznie: `npx web-push generate-vapid-keys` — format jest identyczny.)

### Zmienne w Cloudflare Pages

`Projekt Pages → Settings → Variables and secrets` (Production):

| Nazwa | Typ | Wartość |
|---|---|---|
| `AUTH_SECRET` | Secret | losowy ciąg 40+ znaków (z generatora wyżej) |
| `AUTH_USERS` | Secret | konta: `ania:Silne#Haslo;bartek:InneHaslo` |
| `VAPID_PUBLIC_KEY` | Plaintext | z generatora wyżej |
| `VAPID_PRIVATE_KEY` | Secret | z **tej samej pary** |
| `VAPID_SUBJECT` | Secret | `mailto:ty@example.com` |
| `CRON_SECRET` | Secret | losowy ciąg chroniący `/api/push-send` |
| `TMDB_API_KEY` | Secret | *(opcjonalnie)* TMDB Read Access Token |

> ⚠️ Oba klucze VAPID muszą pochodzić z jednej pary. Po dodaniu zmiennych/bindingów zrób **Redeploy** (Deployments → Redeploy) — bez tego nie wejdą w życie. Po rotacji kluczy VAPID każde urządzenie musi włączyć powiadomienia od nowa (iOS: usuń PWA → restart → zainstaluj → włącz push).

### Cron powiadomień (co godzinę)

Cloudflare Pages nie ma wbudowanych cronów — użyj darmowego [cron-job.org](https://cron-job.org):

- URL: `https://TWOJ-PROJEKT.pages.dev/api/push-send?secret=TWOJ_CRON_SECRET`
- Harmonogram: co godzinę (minuta 0) · Metoda: GET

Endpoint zwraca JSON `{"ok":true,"checked":…,"sent":…}`. Do testów: dopisz `&test=1` — wyśle wszystko z harmonogramu od razu.

### TMDB API (okładki seriali)

1. Zarejestruj się na [themoviedb.org](https://www.themoviedb.org)
2. `Account → Settings → API → Create → Developer`
3. Skopiuj **API Read Access Token (v4)** → zmienna `TMDB_API_KEY` w Cloudflare

Proxy (`/api/tmdb-search`) ukrywa klucz przed klientem. Użytkownicy demo mogą wpisać własny token w Ustawieniach aplikacji.

### Pierwsze logowanie

Ustawienia → **Konto** → login i hasło z `AUTH_USERS`. Od tej chwili dane synchronizują się automatycznie; na iOS zainstaluj PWA (Udostępnij → *Do ekranu początkowego*), otwórz z ikony i włącz powiadomienia. Dzwoneczek 🔔 włączasz osobno przy każdym serialu.

---

## Struktura projektu

```
serialist/
├── public/
│   ├── index.html        ← HTML shell + SVG sprite
│   ├── style.css         ← Wszystkie style
│   ├── app.js            ← Logika aplikacji (IDB, kalendarz, sync, push)
│   ├── sw.js             ← Service Worker
│   ├── manifest.json     ← PWA manifest
│   └── icons/            ← SVG ikony aplikacji
├── functions/
│   └── api/
│       ├── config.js         ← Publiczny klucz VAPID (auto-konfiguracja)
│       ├── auth-login.js     ← Logowanie (AUTH_USERS → JWT HS256, 90 dni)
│       ├── sync.js           ← Synchronizacja stanu z D1 (LWW)
│       ├── tmdb-search.js    ← TMDB proxy
│       ├── push-subscribe.js ← Subskrypcje push per użytkownik (D1)
│       └── push-send.js      ← Wysyłka push (RFC 8291/8292, endpoint crona)
├── schema.sql            ← Schemat bazy D1
├── wrangler.toml         ← Dokumentacja konfiguracji Pages
├── LICENSE               ← MIT
├── CONTRIBUTING.md
└── README.md
```

---

## Lokalny development

```bash
npx wrangler pages dev public --d1 DB=serialist-db --compatibility-date=2024-01-01

# Lokalny plik z sekretami (nie commituj!)
# .dev.vars
AUTH_SECRET=dev-secret
AUTH_USERS=dev:dev
VAPID_PUBLIC_KEY=BxxxxA
VAPID_PRIVATE_KEY=yxxxxA
TMDB_API_KEY=eyJhbG...
```

---

## Autor

Stworzony przez **SushiPL-coder**
Projekt w pełni open-source na licencji MIT. Pull requesty mile widziane!

## Contributing

Zobacz [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 SushiPL-coder

---
---

<a name="english"></a>

<div align="center">
  <img src="public/icons/icon-192.svg" width="80" alt="Serialist icon">

  <h1>Serialist</h1>

  <p>Your personal tracker for TV shows and YouTube channels.<br>
  Weekly Calendar · Episode Tracking · Cloud Sync · Push Notifications · TMDB</p>

  <p>
    <a href="#demo-en">Demo</a> ·
    <a href="#installation-self-hosting">Installation</a> ·
    <a href="#configuration">Configuration</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>

  <img src="https://img.shields.io/github/license/SushiPL-coder/Serialist?style=flat-square&color=7C6BFE" alt="MIT License">
  <img src="https://img.shields.io/badge/PWA-ready-7C6BFE?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Cloudflare-Pages%20%2B%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages + D1">
  <img src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
</div>

## About

Serialist is for everyone who follows many TV shows or YouTube channels at once and wants it all under control — no notebook scribbles, no digging through watch history.

Add the shows you watch, define their release schedule, and the weekly calendar shows you when new episodes drop. Tick off what you've seen; the catch-up backlog collects everything you missed. Push notifications remind you up to an hour before air time.

**Demo mode (no login):** all data stays on your device (IndexedDB) — no accounts, no cloud. That's how the public instance at [serialist.pages.dev](https://serialist.pages.dev) works.

**Account mode (self-hosted):** optional login enables automatic sync with Cloudflare D1 — data survives PWA reinstalls and syncs across devices, and the server sends real per-episode push notifications. Accounts are created by the instance owner (no open registration).

## Features

- **Weekly calendar** — 7-day view with platform color coding
- **Watch tracking** — mark episodes watched, track season progress
- **Catch-up backlog** — automatic list of episodes you missed (last 30 days)
- **YouTube support** — "every X days" schedules, perfect for YT channels
- **TMDB integration** — search a show, fetch the poster automatically
- **Cloud sync** *(optional)* — Cloudflare D1, last-write-wins, auto-sync 3 s after every change
- **Push notifications** — alert up to 1 h before a specific episode airs (incl. iOS 16.4+)
- **PWA** — install like an app, works offline, keyboard never covers inputs
- **Watchlist** — a separate tab for shows to watch in the future
- **JSON export / import** — full control over your data

<a name="demo-en"></a>

## Demo

```
https://serialist.pages.dev
```

The public instance runs in demo mode — local data only. For TMDB search, paste your own free **API Read Access Token** in *Settings*.

## Installation (self-hosting)

1. **Fork** this repo → Cloudflare **Workers & Pages → Create → Pages → Connect to Git** → framework `None`, build output `public` → Deploy (demo mode works now).
2. **D1**: Storage & Databases → D1 → Create `serialist-db` → Console → paste [`schema.sql`](schema.sql) → Execute. Then Pages → Settings → Bindings → D1: variable name `DB`.
3. **Variables** (Pages → Settings → Variables and secrets): `AUTH_SECRET`, `AUTH_USERS` (`alice:pass;bob:pass`), `VAPID_PUBLIC_KEY` (plaintext), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, optional `TMDB_API_KEY`. Generate keys with the browser-console snippet in the Polish section above or `npx web-push generate-vapid-keys`. **Redeploy** afterwards.
4. **Cron**: Pages has no built-in cron — create an hourly job at [cron-job.org](https://cron-job.org) calling `https://YOUR-PROJECT.pages.dev/api/push-send?secret=YOUR_CRON_SECRET` (add `&test=1` for instant test sends).
5. Log in via *Settings → Account*, install the PWA on iOS (Share → Add to Home Screen), enable notifications, and turn on the 🔔 bell per series.

Push encryption is implemented from scratch on Web Crypto (RFC 8291 aes128gcm + RFC 8292 VAPID) and verified against the official RFC 8291 test vector. Stale subscriptions (HTTP 404/410) are cleaned up automatically.

## License

[MIT](LICENSE) © 2026 SushiPL-coder
