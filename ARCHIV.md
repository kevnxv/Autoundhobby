# Archiv: Kategorien, die gerade nicht online sind

Seit dem 22.11.2026 zeigt die Website nur die Mietwerkstatt. Die Startseite mit der
Kategorienauswahl, der Autoankauf (67 Seiten) und die Autoteile sind aus `main` gelöscht.
Sie sind nicht verloren: Zwei Git-Tags auf GitHub halten sie fest.

| Tag | Inhalt |
| --- | --- |
| `archiv/alle-kategorien-live-2026-11-22` | Letzter Live-Stand mit Startseite (drei Kacheln), Autoankauf, Autoteile und Reifenwechsel. Design wie die heutige Mietwerkstatt. |
| `archiv/ankauf-kundenfreundlich-2026-11-05` | Neuester Stand der Ankaufseiten aus PR #15 (besseres Formular, Abholung, Anruf zuerst). Nie gemergt, Design „Markenauftritt“ mit eckigen Formen. |

## Ansehen

```
git fetch --tags
git worktree add ../Autoundhobby-archiv archiv/alle-kategorien-live-2026-11-22
node ../Autoundhobby-archiv/e2e/server.mjs 4340
```

Danach im Browser `http://127.0.0.1:4340/` öffnen.

## Wieder online bringen

Ordner aus dem Tag zurückholen, zum Beispiel den Autoankauf und die Autoteile:

```
git checkout archiv/alle-kategorien-live-2026-11-22 -- autoankauf autoteile index.html
```

Danach von Hand nachziehen, weil sich die Seite seit dem Archiv geändert hat:

- Kategorie-Leiste und Links in der Fußzeile auf Mietwerkstatt, Impressum und Datenschutz wieder einsetzen.
- `sitemap.xml` neu schreiben (`node werkzeuge/modelle.mjs` schreibt sie aus allen Seiten).
- Tests in `e2e/seite.spec.mjs` für Startseite, Ankauf und Teile aus dem Tag zurückholen.
- Texte der Mietwerkstatt nicht überschreiben: Der Stand in `main` ist der gültige
  (Handwerkzeug, Standgebühr 15 €, große SUV 20 €).

Die Werkzeuge und Daten für den Ankauf (`werkzeuge/`, `daten/`, Modellfotos unter `assets/`)
liegen weiter in `main`.
