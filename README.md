<div align="center">
  <img src="public/icons/icon-192.svg" width="80" alt="Serialist icon">

  <h1>Serialist</h1>

  <p>Open-source PWA do śledzenia seriali TV i kanałów YouTube.<br>
  Kalendarz tygodniowy · Śledzenie obejrzanych odcinków · Push notifications · TMDB</p>

  <p>
    <a href="#demo">Demo</a> ·
    <a href="#instalacja">Instalacja</a> ·
    <a href="#konfiguracja">Konfiguracja</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>

  <img src="https://img.shields.io/github/license/YOUR_HANDLE/serialist?style=flat-square&color=7C6BFE" alt="MIT License">
  <img src="https://img.shields.io/badge/PWA-ready-7C6BFE?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
</div>

---

## Funkcje

- **Kalendarz tygodniowy** — widok 7 dni z kolorowymi oznaczeniami platform
- **Śledzenie obejrzanych** — zaznaczaj odcinki jako obejrzane, śledź postęp
- **Do nadrobienia** — automatyczna lista odcinków które przegapiłeś
- **YouTube support** — harmonogram "co X dni" idealny dla kanałów YT
- **TMDB integration** — wyszukaj serial, pobierz okładkę automatycznie
- **Push notifications** — powiadomienie 30 min przed emisją
- **PWA** — instalujesz jak aplikację, działa offline
- **Watchlist** — osobna zakładka na seriale do obejrzenia w przyszłości
- **100% client-side data** — dane w IndexedDB na Twoim urządzeniu

## Stos technologiczny

| Warstwa | Technologia | Licencja |
|---------|-------------|----------|
| Frontend | Vanilla JS + Web APIs | — |
| CSS | Custom CSS, system fonts | — |
| Ikony | Lucide Icons (inline SVG) | MIT |
| Fonty | Outfit via Bunny Fonts | OFL |
| Hosting | Cloudflare Pages | Free tier |
| API proxy | Cloudflare Functions | — |
| Push | Web Push API + VAPID | — |
| Okładki | TMDB API | ToS |
| Storage | IndexedDB (native) | — |

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
