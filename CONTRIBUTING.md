# Contributing to Serialist

Dziękuję za chęć pomocy! Poniżej zasady współpracy.

## Jak zgłosić błąd

1. Sprawdź czy issue już istnieje
2. Otwórz nowe Issue z tagiem `bug`
3. Opisz: co zrobiłeś, co się stało, co powinno się stać
4. Dołącz: wersję przeglądarki, platform, screenshot jeśli możesz

## Jak zaproponować funkcję

1. Otwórz Issue z tagiem `enhancement`
2. Opisz przypadek użycia (po co to potrzebne)
3. Poczekaj na dyskusję przed pisaniem kodu

## Pull Requests

```bash
# 1. Fork repozytorium
# 2. Utwórz gałąź
git checkout -b feature/nazwa-funkcji

# 3. Wprowadź zmiany
# 4. Sprawdź składnię JS
node --check public/app.js
node --check public/sw.js

# 5. Commit z konwencją
git commit -m "feat: opis zmiany"
# lub: fix:, docs:, style:, refactor:, chore:

# 6. Push i otwórz PR do gałęzi dev
```

## Zasady kodu

- Vanilla JS — bez frameworków, bez bundlerów
- Brak zewnętrznych zależności runtime (tylko Bunny Fonts CDN)
- Komentarze po polsku lub angielsku — byle konsekwentnie
- `node --check` musi przejść bez błędów
- Nowe stores IDB tylko w `onupgradeneeded`

## Licencja

Wnosząc kod, zgadzasz się że Twój wkład zostanie opublikowany na licencji MIT.
