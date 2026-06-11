# Serialist

> Śledź seriale TV i kanały YouTube w pięknym kalendarzu PWA.

[![Licencja: MIT](https://img.shields.io/badge/Licencja-MIT-purple.svg)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Hosting-Cloudflare%20Pages-orange)](https://serialist.pages.dev)
[![Wersja](https://img.shields.io/badge/wersja-0.3.0-blueviolet)]()

🇬🇧 [English README](README.md)

---

## Funkcje

- 📅 **Kalendarz tygodniowy** – widok dzień po dniu z kropkowymi wskaźnikami odcinków
- 📺 **Wszystkie platformy** – Netflix, HBO Max, Disney+, Prime, Apple TV+, Hulu, SkyShowtime, Canal+, YouTube i inne
- 🔁 **Elastyczne harmonogramy** – co tydzień, co N dni, ręczne daty
- 🎬 **Wiele odcinków naraz** – Netflix zrzuca cały sezon? Ustaw liczbę odcinków na datę
- ✅ **Śledzenie obejrzanych** – zaznaczaj odcinki; zaległości z ostatnich 30 dni
- 🔔 **Powiadomienia push** – VAPID Web Push przez Cloudflare Worker
- 🔍 **Wyszukiwanie okładek TMDB** – automatyczne plakaty (wymaga klucza API)
- 📦 **Eksport / Import** – kopia zapasowa JSON (ważne na iOS!)
- 📱 **Instalowalne PWA** – działa offline; baner instalacji na iOS i Android
- 🌐 **Vanilla JS** – brak frameworków, brak bundlerów; deploy przez GitHub web UI

---

## Demo

**[serialist.pages.dev](https://serialist.pages.dev)**

---

## Szybki deploy (bez CLI)

1. Forkuj to repo na GitHubie
2. Cloudflare Pages → **Utwórz → Połącz z Git** → wybierz swój fork
3. Ustawienia buildu: katalog wyjściowy `public`, brak komendy build
4. Dodaj [zmienne środowiskowe](#zmienne-środowiskowe)
5. Push do `main` → auto-deploy

---

## Zmienne środowiskowe

Ustaw w **Cloudflare Pages → Settings → Environment variables**:

| Zmienna | Wymagane | Opis |
|---|---|---|
| `TMDB_API_KEY` | Zalecane | API Read Access Token z [themoviedb.org](https://www.themoviedb.org/settings/api) |
| `VAPID_PUBLIC_KEY` | Do push | Generuj: `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Do push | (z powyższego) |
| `VAPID_SUBJECT` | Do push | `mailto:twoj@email.pl` |
| `CRON_SECRET` | Do push | Losowy string |

### KV Namespace (subskrypcje push)

1. Cloudflare Dashboard → **Workers & Pages → KV → Utwórz namespace** → nazwa: `PUSH_SUBS`
2. Skopiuj **Namespace ID**
3. W `wrangler.toml` wklej ID w sekcji `[[kv_namespaces]]`

---

## ⚠️ Utrata danych na iOS

> iOS Safari kasuje wszystkie dane PWA (IndexedDB) gdy usuniesz aplikację z ekranu głównego.  
> Używaj **Ustawienia → Eksportuj JSON** i regularnie rób kopię!

---

## Changelog

Zobacz [CHANGELOG.md](CHANGELOG.md).

---

## Licencja

MIT © [SushiPL-coder](https://github.com/SushiPL-coder)
