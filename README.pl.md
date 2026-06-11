# 📺 Serialist

**Open-source'owy tracker seriali i kanałów YouTube — instalowalna PWA.**

Śledź seriale tygodniowe, wydania co N dni i ręczne daty premier, odhaczaj obejrzane odcinki, prowadź backlog „do nadrobienia" i watchlistę nadchodzących premier. Vanilla JS, IndexedDB i Cloudflare Pages — bez frameworków, bez build stepu.

🇬🇧 [English README](README.md)

---

## ✨ Wypróbuj demo

**https://serialist.pages.dev**

Publiczna strona działa w **trybie demo**: wszystko zapisuje się lokalnie na Twoim urządzeniu (IndexedDB), nic nie jest nigdzie wysyłane. Aby w demo działało wyszukiwanie tytułów i plakatów z TMDB, wklej w *Ustawieniach* własny darmowy **API Read Access Token** z TMDB (themoviedb.org → Settings → API).

> ⚠️ Tryb demo = dane tylko lokalnie. Na iOS usunięcie PWA z ekranu głównego kasuje dane. Rób kopie przez *Ustawienia → Eksportuj JSON* — albo postaw własną instancję z kontami i synchronizacją (niżej).

Logowanie, synchronizacja w chmurze i powiadomienia push są dostępne tylko dla kont założonych przez właściciela instancji. Chcesz je mieć? **Postaw własną instancję — za darmo** (free tier Cloudflare), zajmuje ~15 minut.

---

## 🚀 Funkcje

- 📅 **Kalendarz tygodniowy** z paskiem dni, kartami odcinków i odhaczaniem
- 🔁 **Trzy typy harmonogramów**: tygodniowy (wybór dni), interwałowy (co N dni), ręczne daty
- 🧮 Automatyczna numeracja odcinków (S/E), kilka odcinków naraz, długości sezonów
- 🕳️ **Backlog** „do nadrobienia" — przegapione odcinki z ostatnich 30 dni
- 🔖 **Watchlista** premier z odliczaniem
- 🔍 **Wyszukiwanie TMDB** — tytuły + plakaty (klucz serwerowy albo własny)
- ☁️ **Opcjonalna synchronizacja w chmurze** (Cloudflare D1) — dane przeżywają reinstalację, synchronizują się między urządzeniami
- 🔔 **Web Push** — powiadomienie do godziny przed premierą odcinka (RFC 8291/8292, działa na iOS 16.4+)
- 📱 Instalowalna PWA, offline-first, przyjazna iOS i Androidowi (modale nie chowają się pod klawiaturą)
- 🆓 Utrzymanie w 100% darmowe: Cloudflare Pages + Functions + D1 free tier

---

## 🛠️ Własna instancja (pełna instrukcja)

Wszystko działa na darmowym planie Cloudflare. Bez CLI — tylko dashboard.

### 1. Deploy na Cloudflare Pages

1. Zrób fork tego repozytorium.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → wybierz swój fork.
3. Ustawienia builda: bez frameworka, **build output directory: `public`**. Deploy.

Na tym etapie aplikacja działa już w trybie demo.

### 2. Baza D1 (konta + synchronizacja + push)

1. Dashboard → **Storage & Databases → D1 → Create** → nazwa: `serialist-db`.
2. Otwórz bazę → **Console** → wklej zawartość [`schema.sql`](schema.sql) → Execute.
3. Projekt Pages → **Settings → Bindings → Add → D1 database**:
   - Variable name: `DB`
   - Database: `serialist-db`

### 3. Zmienne środowiskowe

Projekt Pages → **Settings → Variables and secrets** (Production):

| Nazwa | Typ | Wartość |
|---|---|---|
| `AUTH_SECRET` | Secret | Długi losowy ciąg (40+ znaków) — podpisuje tokeny logowania |
| `AUTH_USERS` | Secret | Konta: `ania:Silne#Haslo;bartek:InneHaslo` |
| `VAPID_PUBLIC_KEY` | Plaintext | Z `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Secret | Z **tej samej** wygenerowanej pary |
| `VAPID_SUBJECT` | Secret | `mailto:ty@example.com` |
| `CRON_SECRET` | Secret | Losowy ciąg chroniący `/api/push-send` |
| `TMDB_API_KEY` | Secret | *(opcjonalnie)* TMDB Read Access Token dla wyszukiwania po stronie serwera |

Klucze VAPID wygenerujesz lokalnie:

```bash
npx web-push generate-vapid-keys
```

> ⚠️ Oba klucze VAPID **muszą pochodzić z tej samej pary**, a prywatny musi być w surowej formie base64url, jaką wypisuje web-push (≈43 znaki). Po każdej rotacji kluczy każde urządzenie musi włączyć powiadomienia od nowa (iOS: usuń PWA, restart telefonu, zainstaluj ponownie, zaloguj się, włącz push).

Po dodaniu bindingów/zmiennych zrób **Redeploy** projektu (Deployments → Redeploy).

### 4. Cron powiadomień (co godzinę)

Cloudflare Pages nie ma wbudowanego crona — użyj darmowego zewnętrznego, np. [cron-job.org](https://cron-job.org):

- URL: `https://TWOJ-PROJEKT.pages.dev/api/push-send?secret=TWOJ_CRON_SECRET`
- Harmonogram: **co godzinę** (np. minuta 0)
- Metoda: GET

Endpoint zwraca JSON (`{"ok":true,"checked":…,"sent":…}`) — przydatny do monitoringu.

### 5. Korzystanie

1. Otwórz swoją instancję → **Ustawienia → Konto** → zaloguj się użytkownikiem z `AUTH_USERS`.
2. Dane synchronizują się do D1 automatycznie (3 s po każdej zmianie, przy powrocie do aplikacji, po odzyskaniu sieci). Reinstalacja PWA niczego już nie kasuje — wystarczy zalogować się ponownie.
3. (iOS) Zainstaluj PWA: Udostępnij → *Do ekranu początkowego*, otwórz z ikony, potem **Ustawienia → Włącz powiadomienia**. Push wymaga iOS 16.4+ i zainstalowanej PWA.
4. Włącz 🔔 przy każdym serialu, o którym chcesz dostawać powiadomienia.

---

## 🧱 Architektura

```
public/                  PWA w Vanilla JS (IndexedDB = główny magazyn, offline-first)
functions/api/
  config.js              GET  /api/config          publiczny klucz VAPID + możliwości instancji
  auth/login.js          POST /api/auth/login      weryfikacja AUTH_USERS → JWT HS256 (90 dni)
  sync.js                GET/PUT /api/sync         synchronizacja całego stanu (LWW) do D1;
                                                   covery osobno; upload 14-dniowego harmonogramu
  push-subscribe.js      POST/DELETE               subskrypcje push per użytkownik (D1)
  push-send.js           GET /api/push-send        endpoint crona; RFC 8291 aes128gcm +
                                                   RFC 8292 VAPID, czyste Web Crypto, zero zależności
schema.sql               schemat D1
```

**Model synchronizacji:** klient trzyma znacznik `lastChange`; przy starcie pobiera stan z serwera i wygrywa nowsza strona (last-write-wins na całym stanie). Proste, przewidywalne, idealne dla jednej osoby na kilku urządzeniach. Tryb demo (bez logowania) nie wysyła danych do sieci.

**Pipeline powiadomień:** przy każdej synchronizacji klient wysyła odcinki na najbliższe 14 dni (dla seriali z 🔔) razem ze strefą czasową urządzenia → cogodzinny cron wybiera wpisy z premierą w ciągu najbliższych 60 minut → szyfruje payload osobno dla każdej subskrypcji → oznacza wpis jako wysłany. Wygasłe subskrypcje (HTTP 404/410) są usuwane automatycznie.

Szyfrowanie push napisane od zera na Web Crypto i zweryfikowane na oficjalnym wektorze testowym z RFC 8291 (Appendix A).

---

## 🔒 Bezpieczeństwo i prywatność

- Brak otwartej rejestracji: konta istnieją tylko w `AUTH_USERS`. Demo niczego nie zapisuje po stronie serwera.
- Logowanie wydaje token HMAC-SHA256 (HS256) ważny 90 dni; endpointy danych go wymagają.
- Token TMDB wpisany w trybie demo zostaje wyłącznie w lokalnym IndexedDB.
- Okładki są kompresowane po stronie klienta (max 600 px JPEG) przed zapisem/synchronizacją.

## 📄 Licencja

MIT — zobacz [LICENSE](LICENSE). Autor: **SushiPL-coder**.
