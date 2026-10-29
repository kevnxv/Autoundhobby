# Autoundhobby

Nicht-öffentliche Designvorschau. Die statischen Seiten liegen im Repository-Root und sind noch nicht zur öffentlichen Indexierung bestimmt (`robots.txt` sperrt, jede Seite trägt `noindex`). Den Umzug auf autoundhobby.de beschreibt [LIVEGANG.md](LIVEGANG.md).

Die Seite ist reines HTML, CSS und JavaScript ohne Build. Node braucht es nur für die Werkzeuge und die Tests.

## Pflege

| Aufgabe | So geht es |
|---|---|
| Neues Modell oder Modelltext ändern | Markdown-Datei in `daten/modelle/<marke>-<modell>.md` anlegen oder ändern (Kopfdaten wie bei den vorhandenen), dann `node werkzeuge/modelle.mjs`. Das schreibt alle Modellseiten unter `autoankauf/<marke>/<modell>/`, den Finder auf `autoankauf/`, die Modellkarten der Markenseiten, den Bildnachweis im Impressum und `sitemap.xml`. Fotos: `assets/modelle/<marke>-<modell>.webp` und `-480.webp`, Nachweis in `daten/modellfotos.json`. |
| Zuletzt angekauft | Nach jedem Ankauf einen Eintrag in `daten/angekauft.json` (Marke, Modell, Baujahr, Zustand, Monat, Foto, Alt-Text) und das Foto nach `assets/angekauft/`, dann `node werkzeuge/angekauft.mjs`. Keine Preise, keine Namen, Kennzeichen unkenntlich. Das Werkzeug prüft das und schreibt sonst nichts. |
| Prüfen | `npm test` (Playwright, Chromium und WebKit, ohne Netz). Zum Ansehen: `npm run server`, dann http://127.0.0.1:4340/ |

Beispiel für einen Eintrag in `daten/angekauft.json`:

```json
[
  { "marke": "VW", "markeSlug": "vw", "modell": "Golf 7", "baujahr": 2014, "zustand": "Motorschaden", "monat": "2026-10",
    "foto": "assets/angekauft/2026-10-vw-golf-7.webp", "fotoAlt": "Schwarzer VW Golf 7 in der Halle in Oberbilk" }
]
```
