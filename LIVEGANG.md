# Livegang auf autoundhobby.de

Stand 2026-10-29. Die Seite bleibt auf GitHub Pages (Repo `kevnxv/Autoundhobby`, Branch `main`, Ordner `/`). Heute ist sie eine gesperrte Vorschau unter https://kevnxv.github.io/Autoundhobby/. Schon vorbereitet sind die Canonical-Tags auf `https://autoundhobby.de/…` in allen 16 Seiten, `sitemap.xml` und 12 Ersatzseiten für die alten WordPress-Adressen.

## 1. Vorher klären (blockiert den Livegang)

- [ ] Impressum: voller Vorname des Inhabers, E-Mail-Adresse, USt-ID und Handelsregister, falls vorhanden. Danach den Hinweis "Entwurf, noch nicht rechtlich geprüft" in `impressum/index.html` entfernen.
- [ ] Datenschutzerklärung rechtlich prüfen lassen, dann den Entwurfshinweis in `datenschutz/index.html` entfernen.
- [ ] Bildrechte an den Fotos der Halle beim Inhaber bestätigen.
- [ ] Hersteller-Logos in der Markenreihe auf `autoankauf/` rechtlich prüfen lassen. Besonders den Mercedes-Stern: Mercedes hat sein Logo aus der freien Sammlung simple-icons entfernen lassen, der Stern in `daten/marken-logos/mercedes.svg` ist deshalb selbst nachgezeichnet. Falls die Prüfung abrät, die Datei löschen und `node werkzeuge/modelle.mjs` laufen lassen, dann steht Mercedes wieder nur als Schriftzug da.
- [ ] Die 27 Toyota-Fotos von Wikimedia Commons (Namensnennung, Nachweis im Impressum unter `#bildnachweis`) rechtlich prüfen lassen.
- [ ] Inhaber liest die technischen Aussagen der 55 Modelltexte gegen, vor allem die 25 Toyota-Texte, die er noch nicht gesehen hat.
- [ ] Inhaber bestätigt den Ankauf ohne gültigen TÜV (Seite `autoankauf/ohne-tuev/`). Im alten Projekt stand diese Frage noch offen.
- [ ] Zugang zum one.com-Konto, in dem die Domain liegt.

## 2. DNS bei one.com umstellen

Die Domain liegt bei one.com (Nameserver `ns01.one.com`, `ns02.one.com`). Dort läuft heute auch die alte Seite (`46.30.215.183`) und **die E-Mail** (MX auf `mx1` bis `mx4.mailpod16-cph3.g1i.one.com`).

**Die MX-Einträge nicht anfassen.** Sonst kommen keine Mails mehr an.

Nur diese Einträge ändern (one.com: DNS-Einstellungen der Domain):

| Name | Typ | Wert |
|---|---|---|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| `www` | CNAME | `kevnxv.github.io` |

Die alten A- und AAAA-Einträge von `@` und `www` (heute `46.30.215.183` und `2a02:2350:5:106:80bd:1c00:20a:7736`) dabei löschen, sonst landen Besucher weiter auf der alten Seite. Falls one.com die Webseite über einen eigenen Schalter ("Website" oder "Webhosting") an die Domain bindet, diesen für die Domain lösen, die E-Mail bleibt davon unberührt.

## 3. GitHub einstellen

1. Domain bestätigen, damit niemand anderes sie bei GitHub Pages benutzen kann: GitHub, Settings (Konto), Pages, "Add a domain", `autoundhobby.de`. GitHub zeigt einen TXT-Eintrag, den bei one.com anlegen und dort "Verify" klicken.
2. Repo `Autoundhobby`, Settings, Pages, Custom domain: `autoundhobby.de` eintragen und speichern. GitHub legt dabei die Datei `CNAME` im Repo an.
3. Warten, bis der DNS-Check grün ist (Minuten bis einige Stunden), dann "Enforce HTTPS" einschalten.

Die Datei `CNAME` erst in diesem Schritt anlegen lassen. Liegt sie vorher im Repo, leitet GitHub die Vorschau sofort auf eine Domain um, die noch nicht auf GitHub zeigt.

## 4. Für Google freigeben

Erst wenn `https://autoundhobby.de/` die neue Seite zeigt:

1. `robots.txt` ersetzen durch:
   ```
   User-agent: *
   Allow: /

   Sitemap: https://autoundhobby.de/sitemap.xml
   ```
2. In allen 16 Seiten die Zeile `<meta name="robots" content="noindex,nofollow">` entfernen:
   ```bash
   git ls-files '*.html' | xargs sed -i 's#<meta name="robots" content="noindex,nofollow">##'
   ```
3. README anpassen (sie nennt die Seite noch eine nicht-öffentliche Vorschau), committen, pushen.
4. Google Search Console: Domain-Property `autoundhobby.de` (Bestätigung per TXT bei one.com), `sitemap.xml` einreichen.

## 5. Prüfen

| Befehl | Erwartet |
|---|---|
| `curl -sI https://autoundhobby.de/` | 200 |
| `curl -sI http://autoundhobby.de/` | 301 auf `https://autoundhobby.de/` |
| `curl -sI https://www.autoundhobby.de/` | 301 auf `https://autoundhobby.de/` |
| `curl -s https://autoundhobby.de/kfz-ankauf/ \| grep refresh` | Weiterleitung nach `../autoankauf/` |
| `curl -s https://autoundhobby.de/ \| grep -c noindex` | 0 |
| `curl -s https://autoundhobby.de/robots.txt` | `Allow: /` und die Sitemap-Zeile |
| Testmail an eine Adresse `@autoundhobby.de` | kommt an |

## Alte Adressen

Gesammelt am 2026-10-29 aus der WordPress-Sitemap der alten Seite und `site:autoundhobby.de`. GitHub Pages kann keine echten 301, deshalb steht unter jeder alten Adresse eine Ersatzseite mit sofortiger Weiterleitung und Canonical auf das Ziel.

| Alte Adresse | Ziel |
|---|---|
| `/kfz-ankauf/` | `/autoankauf/` |
| `/preisliste/`, `/preise/` | `/mietwerkstatt/#preise` |
| `/bildergalerie/`, `/bilder/` | `/mietwerkstatt/` |
| `/cookie-richtlinie-eu/` | `/datenschutz/` |
| `/wegbeschreibung/` | `/mietwerkstatt/#kontakt` |
| `/hello-world/`, `/hello-world/feed/`, `/feed/`, `/category/uncategorized/`, `/author/moinier/` | `/` |

`/impressum/` und `/datenschutz/` gibt es alt und neu unter derselben Adresse. Die alten Sitemaps (`/wp-sitemap*.xml`) lassen sich auf GitHub Pages nicht weiterleiten, sie laufen ins Leere, Google lässt sie dann fallen.
