<div align="center">
  <img src="public/icons/icon-192.svg" width="80" alt="Serialist icon">

  <h1>Serialist</h1>

  <p>Twój osobisty tracker seriali TV i kanałów YouTube.<br>
  Kalendarz tygodniowy · Śledzenie obejrzanych odcinków · Push notifications · TMDB</p>

  <p>
    <a href="#demo">Demo</a> ·
    <a href="#instalacja">Instalacja</a> ·
    <a href="#konfiguracja">Konfiguracja</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>

  <img src="https://img.shields.io/github/license/SushiPL-coder/Serialist?style=flat-square&color=7C6BFE" alt="MIT License">
  <img src="https://img.shields.io/badge/PWA-ready-7C6BFE?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
</div>

---

> 🇬🇧 [English version below](#english) · 🇵🇱 Polska wersja poniżej

---

## O aplikacji

Serialist to aplikacja dla wszystkich, którzy śledzą wiele seriali TV lub kanałów YouTube jednocześnie i chcą mieć to wszystko pod kontrolą — bez zapisków w notatniku, bez przekopywania historii oglądania.

Dodajesz seriale, które oglądasz lub chcesz obejrzeć. Określasz harmonogram emisji. Aplikacja pokazuje Ci w kalendarzu tygodniowym kiedy wychodzą nowe odcinki, zaznaczasz co już widziałeś, a lista "do nadrobienia" zbiera wszystko, co Ci umknęło. Powiadomienia push przypomną Ci 30 minut przed emisją — żebyś nie przegapił premiery.

Wszystkie dane zostają na Twoim urządzeniu. Zero kont, zero synchronizacji z chmurą — tylko Ty i Twoje seriale.

## Funkcje

- **Kalendarz tygodniowy** — widok 7 dni z kolorowymi oznaczeniami platform
- **Śledzenie obejrzanych** — zaznaczaj odcinki jako obejrzane, śledź postęp sezonu
- **Do nadrobienia** — automatyczna lista odcinków, które przegapiłeś
- **YouTube support** — harmonogram "co X dni" idealny dla kanałów YT
- **TMDB integration** — wyszukaj serial, pobierz okładkę automatycznie
- **Push notifications** — powiadomienie 30 min przed emisją
- **PWA** — instalujesz jak aplikację, działa offline
- **Watchlist** — osobna zakładka na seriale do obejrzenia w przyszłości
- **100% client-side data** — dane w IndexedDB na Twoim urządzeniu

## Stos technologiczny

| Warstwa   | Technologia               | Licencja  |
|-----------|---------------------------|-----------|
| Frontend  | Vanilla JS + Web APIs     | —         |
| CSS       | Custom CSS, system fonts  | —         |
| Ikony     | Lucide Icons (inline SVG) | MIT       |
| Fonty     | Outfit via Bunny Fonts    | OFL       |
| Hosting   | Cloudflare Pages          | Free tier |
| API proxy | Cloudflare Functions      | —         |
| Push      | Web Push API + VAPID      | —         |
| Okładki   | TMDB API                  | ToS       |
| Storage   | IndexedDB (native)        | —         |

Żadnych frameworków JS. Żadnych bundlerów. Żadnych node_modules w runtime.

---

## Demo

```
https://serialist.pages.dev
```

---

## Instalacja (self-hosting)

### Wymagania

- Konto Cloudflare (darmowe)
- GitHub account
- Node.js 18+ (tylko do generowania VAPID keys)

### 1. Fork & clone

```bash
git clone https://github.com/YOUR_HANDLE/serialist.git
cd serialist
```

### 2. Cloudflare Pages

1. **dash.cloudflare.com → Workers & Pages → Create**
2. Połącz z GitHub repo `serialist`
3. Build settings:
   - Framework preset: `None`
   - Build command: *(puste)*
   - Build output directory: `public`
4. **Save and Deploy**

### 3. GitHub Secrets

Idź do: `GitHub repo → Settings → Secrets and variables → Actions`

```
CF_API_TOKEN   ← Cloudflare API Token (Edit Workers + Pages)
CF_ACCOUNT_ID  ← Cloudflare Account ID (z dashboardu)
```

---

## Konfiguracja

### Push Notifications (VAPID)

#### Generowanie kluczy

```bash
npm install web-push --save-dev
npx web-push generate-vapid-keys
```

Wynik:
```
Public Key:  BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA=
Private Key: yxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=
```

#### Ustawienie Secrets w Cloudflare Pages

```
Cloudflare → Pages → serialist → Settings → Environment variables

VAPID_PUBLIC_KEY  = BxxxxxxxxA=
VAPID_PRIVATE_KEY = yxxxxxxxxA=
VAPID_SUBJECT     = mailto:twoj@email.pl
CRON_SECRET       = losowy-sekret-do-testow
```

#### KV Namespace (przechowywanie subskrypcji)

```bash
npx wrangler kv:namespace create PUSH_SUBS
```

Skopiuj ID do `wrangler.toml`:
```toml
[[kv_namespaces]]
binding    = "PUSH_SUBS"
id         = "TU_WKLEJ_ID"
preview_id = "TU_WKLEJ_PREVIEW_ID"
```

#### W aplikacji (Ustawienia)

Wklej VAPID Public Key w zakładce Ustawienia → Powiadomienia Push → Włącz.

---

### TMDB API (okładki seriali)

1. Zarejestruj się na [themoviedb.org](https://www.themoviedb.org)
2. `Account → Settings → API → Create → Developer`
3. Skopiuj **API Read Access Token (v4)**

```
Cloudflare: TMDB_API_KEY = eyJhbGc...
```

Proxy Worker (`/api/tmdb-search`) ukrywa klucz przed klientem.

---

## Struktura projektu

```
serialist/
├── public/
│   ├── index.html        ← HTML shell + SVG sprite
│   ├── style.css         ← Wszystkie style
│   ├── app.js            ← Logika aplikacji (IDB, kalend., tracking)
│   ├── sw.js             ← Service Worker
│   ├── manifest.json     ← PWA manifest
│   └── icons/            ← SVG ikony aplikacji
├── functions/
│   └── api/
│       ├── tmdb-search.js    ← TMDB proxy Worker
│       ├── push-subscribe.js ← Zapisuje subskrypcje push
│       └── push-send.js      ← Wysyła powiadomienia (cron)
├── .github/workflows/
│   └── deploy.yml        ← CI/CD → Cloudflare Pages
├── wrangler.toml         ← Cloudflare config
├── LICENSE               ← MIT
├── CONTRIBUTING.md
└── README.md
```

---

## Lokalny development

```bash
# Uruchom lokalnie (Wrangler dev server)
npx wrangler pages dev public --compatibility-date=2024-01-01

# Lokalny plik z secrets (nie commituj!)
# .dev.vars
VAPID_PUBLIC_KEY=BxxxxA=
VAPID_PRIVATE_KEY=yxxxxA=
TMDB_API_KEY=eyJhbG...
```

---

## Autor

Stworzony przez **SushiPL-coder**
Projekt w pełni open-source na licencji MIT. Pull requesty mile widziane!

---

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
  Weekly Calendar · Episode Tracking · Push Notifications · TMDB</p>

  <p>
    <a href="#demo-en">Demo</a> ·
    <a href="#installation">Installation</a> ·
    <a href="#configuration">Configuration</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>

  <img src="https://img.shields.io/github/license/SushiPL-coder/Serialist?style=flat-square&color=7C6BFE" alt="MIT License">
  <img src="https://img.shields.io/badge/PWA-ready-7C6BFE?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
</div>

---

## About

Serialist is a personal show tracker built for people who follow multiple TV series or YouTube channels at once and want to stay on top of it all — no more sticky notes, no more digging through watch history.

You add the shows you're watching or plan to watch, set their airing schedule, and Serialist does the rest. A weekly calendar shows you what's coming up each day. As you watch episodes, you mark them off one by one — the app tracks your progress through each season. Anything you miss automatically lands in a "catch-up" list so nothing slips through the cracks. Push notifications remind you 30 minutes before an episode airs, so you never miss a premiere.

YouTube channels are supported too: instead of a fixed weekly schedule, you define a "new video every X days" rhythm — a much better fit for how creators actually publish.

All your data lives on your device in IndexedDB. No accounts, no cloud sync, no data leaving your browser.

## Features

- **Weekly calendar** — 7-day view with color-coded platform indicators
- **Episode tracking** — mark episodes as watched, track your progress through each season
- **Catch-up list** — automatically collects episodes you've missed
- **YouTube support** — "every X days" schedule, perfect for YouTube channels
- **TMDB integration** — search for a show and pull its poster automatically
- **Push notifications** — reminder 30 minutes before an episode airs
- **PWA** — installable like a native app, works offline
- **Watchlist** — a separate tab for shows you want to watch someday
- **100% client-side data** — everything stored in IndexedDB on your device

## Tech Stack

| Layer     | Technology                | License   |
|-----------|---------------------------|-----------|
| Frontend  | Vanilla JS + Web APIs     | —         |
| CSS       | Custom CSS, system fonts  | —         |
| Icons     | Lucide Icons (inline SVG) | MIT       |
| Fonts     | Outfit via Bunny Fonts    | OFL       |
| Hosting   | Cloudflare Pages          | Free tier |
| API proxy | Cloudflare Functions      | —         |
| Push      | Web Push API + VAPID      | —         |
| Posters   | TMDB API                  | ToS       |
| Storage   | IndexedDB (native)        | —         |

No JS frameworks. No bundlers. No node_modules at runtime.

---

<a name="demo-en"></a>

## Demo

```
https://serialist.pages.dev
```

---

## Installation (self-hosting)

### Requirements

- Cloudflare account (free tier)
- GitHub account
- Node.js 18+ (only needed for generating VAPID keys)

### 1. Fork & clone

```bash
git clone https://github.com/YOUR_HANDLE/serialist.git
cd serialist
```

### 2. Cloudflare Pages

1. **dash.cloudflare.com → Workers & Pages → Create**
2. Connect your GitHub repo `serialist`
3. Build settings:
   - Framework preset: `None`
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. **Save and Deploy**

### 3. GitHub Secrets

Go to: `GitHub repo → Settings → Secrets and variables → Actions`

```
CF_API_TOKEN   ← Cloudflare API Token (Edit Workers + Pages)
CF_ACCOUNT_ID  ← Cloudflare Account ID (from your dashboard)
```

---

## Configuration

### Push Notifications (VAPID)

#### Generating keys

```bash
npm install web-push --save-dev
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA=
Private Key: yxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=
```

#### Setting Secrets in Cloudflare Pages

```
Cloudflare → Pages → serialist → Settings → Environment variables

VAPID_PUBLIC_KEY  = BxxxxxxxxA=
VAPID_PRIVATE_KEY = yxxxxxxxxA=
VAPID_SUBJECT     = mailto:your@email.com
CRON_SECRET       = random-secret-for-testing
```

#### KV Namespace (storing subscriptions)

```bash
npx wrangler kv:namespace create PUSH_SUBS
```

Copy the ID into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding    = "PUSH_SUBS"
id         = "PASTE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"
```

#### In the app (Settings)

Paste your VAPID Public Key under Settings → Push Notifications → Enable.

---

### TMDB API (show posters)

1. Sign up at [themoviedb.org](https://www.themoviedb.org)
2. `Account → Settings → API → Create → Developer`
3. Copy your **API Read Access Token (v4)**

```
Cloudflare: TMDB_API_KEY = eyJhbGc...
```

The proxy Worker (`/api/tmdb-search`) keeps the key hidden from the client.

---

## Project Structure

```
serialist/
├── public/
│   ├── index.html        ← HTML shell + SVG sprite
│   ├── style.css         ← All styles
│   ├── app.js            ← App logic (IDB, calendar, tracking)
│   ├── sw.js             ← Service Worker
│   ├── manifest.json     ← PWA manifest
│   └── icons/            ← App SVG icons
├── functions/
│   └── api/
│       ├── tmdb-search.js    ← TMDB proxy Worker
│       ├── push-subscribe.js ← Saves push subscriptions
│       └── push-send.js      ← Sends notifications (cron)
├── .github/workflows/
│   └── deploy.yml        ← CI/CD → Cloudflare Pages
├── wrangler.toml         ← Cloudflare config
├── LICENSE               ← MIT
├── CONTRIBUTING.md
└── README.md
```

---

## Local Development

```bash
# Run locally (Wrangler dev server)
npx wrangler pages dev public --compatibility-date=2024-01-01

# Local secrets file (do NOT commit!)
# .dev.vars
VAPID_PUBLIC_KEY=BxxxxA=
VAPID_PRIVATE_KEY=yxxxxA=
TMDB_API_KEY=eyJhbG...
```

---

## Author

Built by **SushiPL-coder**
Fully open-source under the MIT license. Pull requests welcome!

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 SushiPL-coder
