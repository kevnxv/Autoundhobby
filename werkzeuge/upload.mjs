// Baut den Ordner zum Hochladen auf one.com (Apache). Aufruf: npm run upload
// Das Repo selbst bleibt die gesperrte Vorschau auf GitHub Pages. Hier entsteht die Fassung für autoundhobby.de:
// ohne noindex, mit freier robots.txt, one.com als Hoster im Datenschutz und einer .htaccess mit echten 301.
// Ziel: ../Autoundhobby-upload/autoundhobby.de (wird jedes Mal neu angelegt).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = resolve(WURZEL, '..', 'Autoundhobby-upload', 'autoundhobby.de');
if (!ZIEL.endsWith(join('Autoundhobby-upload', 'autoundhobby.de'))) throw new Error('Ziel sieht falsch aus: ' + ZIEL);

// Echte Seiten und die Ersatzseiten der alten Adressen (Rückfall, falls mod_rewrite auf dem Server fehlt).
const SEITEN = ['mietwerkstatt', 'impressum', 'datenschutz'];
const ERSATZ = ['index.html', 'kfz-ankauf', 'preise', 'preisliste', 'bilder', 'bildergalerie', 'cookie-richtlinie-eu', 'wegbeschreibung', 'feed', 'hello-world', 'category', 'author'];
// Fotos der Modellseiten und der Ankäufe bleiben weg: Die Seiten dazu sind offline, der Bildnachweis auch (ARCHIV.md).
const ASSETS_OHNE = ['modelle', 'angekauft'];

rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL, { recursive: true });
for (const name of [...SEITEN, ...ERSATZ, 'sitemap.xml']) cpSync(join(WURZEL, name), join(ZIEL, name), { recursive: true });
cpSync(join(WURZEL, 'assets'), join(ZIEL, 'assets'), { recursive: true, filter: (von) => !ASSETS_OHNE.some((o) => von === join(WURZEL, 'assets', o)) });

const ersetze = (text, alt, neu, wo) => {
  if (!text.includes(alt)) throw new Error(`${wo}: Stelle nicht gefunden: ${alt.slice(0, 70)}`);
  return text.split(alt).join(neu);
};
const lies = (pfad) => readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n');

// 1. Sperre für Suchmaschinen aus den echten Seiten nehmen.
for (const seite of SEITEN) {
  const pfad = join(ZIEL, seite, 'index.html');
  writeFileSync(pfad, ersetze(lies(pfad), '<meta name="robots" content="noindex,nofollow">\n', '', seite));
}
writeFileSync(join(ZIEL, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://autoundhobby.de/sitemap.xml\n');

// 2. Datenschutz: Hoster ist one.com, nicht GitHub. Das Postfach liegt auch dort (MX-Einträge der Domain).
{
  const pfad = join(ZIEL, 'datenschutz', 'index.html');
  let s = lies(pfad);
  s = ersetze(s, 'Diese Vorschau wird über GitHub Pages bereitgestellt (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA). Wenn Sie', 'Diese Website liegt auf Servern unseres Hosters one.com (One.com Group AB, Carlsgatan 3, 211 20 Malmö, Schweden). Wenn Sie', 'datenschutz');
  s = ersetze(s, ' Dabei können Daten in die USA übermittelt werden. GitHub ist nach dem EU-US Data Privacy Framework zertifiziert.', '', 'datenschutz');
  s = ersetze(s, 'um Ihre Anfrage zu beantworten. Die Rechtsgrundlagen sind dieselben wie beim Anruf.</p>\n<h2>Speicherdauer</h2>', 'um Ihre Anfrage zu beantworten. Die Rechtsgrundlagen sind dieselben wie beim Anruf. Unser E-Mail-Postfach liegt ebenfalls bei one.com.</p>\n<h2>Speicherdauer</h2>', 'datenschutz');
  writeFileSync(pfad, s);
}

// 3. .htaccess: https ohne www, alte WordPress-Adressen per 301, Kopfzeilen, Cache.
writeFileSync(join(ZIEL, '.htaccess'), `# Auto+Hobby auf one.com (Apache). Erzeugt von werkzeuge/upload.mjs.
# Falls die Seite nach dem Hochladen "zu viele Weiterleitungen" meldet:
# Block 1 löschen und stattdessen im one.com-Control-Panel die HTTPS-Weiterleitung einschalten.

Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
RewriteEngine On

# 1. Immer https und ohne www
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\. [NC]
RewriteRule ^(.*)$ https://autoundhobby.de/$1 [R=301,L]

# 2. Die Hauptadresse zeigt die Mietwerkstatt. 302, weil die Startseite mit den Kategorien später zurückkommt.
RewriteRule ^$ https://autoundhobby.de/mietwerkstatt/ [R=302,L]

# 3. Alte WordPress-Adressen dauerhaft (301) auf die neuen Seiten
RewriteRule ^(preisliste|preise)/?$ https://autoundhobby.de/mietwerkstatt/#preise [R=301,NE,L]
RewriteRule ^(bildergalerie|bilder)/?$ https://autoundhobby.de/mietwerkstatt/ [R=301,L]
RewriteRule ^cookie-richtlinie-eu/?$ https://autoundhobby.de/datenschutz/ [R=301,L]
RewriteRule ^wegbeschreibung/?$ https://autoundhobby.de/mietwerkstatt/#kontakt [R=301,NE,L]
RewriteRule ^wp-sitemap.*\\.xml$ https://autoundhobby.de/sitemap.xml [R=301,L]
# Diese Ziele gibt es gerade nicht (Ankauf, Startseite). 302, damit sie später wieder dorthin zeigen können.
RewriteRule ^(kfz-ankauf|hello-world(/feed)?|feed|category/uncategorized|author/moinier)/?$ https://autoundhobby.de/mietwerkstatt/ [R=302,L]
</IfModule>

# 4. Sicherheits-Header
<IfModule mod_headers.c>
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
Header always set Strict-Transport-Security "max-age=31536000" "expr=%{HTTPS} == 'on'"
</IfModule>

# 5. Schneller laden: Komprimieren und Bilder/Schriften cachen
<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/xml text/xml image/svg+xml
</IfModule>
<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType image/webp "access plus 1 month"
ExpiresByType image/png "access plus 1 month"
ExpiresByType image/svg+xml "access plus 1 month"
ExpiresByType font/woff2 "access plus 1 year"
ExpiresByType text/css "access plus 1 day"
ExpiresByType application/javascript "access plus 1 day"
ExpiresByType text/javascript "access plus 1 day"
ExpiresByType text/html "access plus 0 seconds"
</IfModule>
`);

// 4. Selbstprüfung: Bricht ab, wenn der Ordner nicht zur Live-Fassung passt.
const alle = (ordner) => readdirSync(ordner).flatMap((n) => { const p = join(ordner, n); return statSync(p).isDirectory() ? alle(p) : [p]; });
const dateien = alle(ZIEL);
const fehler = [];
for (const seite of SEITEN) {
  const s = lies(join(ZIEL, seite, 'index.html'));
  if (/noindex/.test(s)) fehler.push(`${seite}: noindex steht noch drin`);
  if (/GitHub|autoankauf|autoteile|facebook/i.test(s)) fehler.push(`${seite}: nennt noch GitHub, Ankauf, Teile oder Facebook`);
  for (const m of s.matchAll(/(?:src|href)="\.\.\/(assets\/[^"#?]+)"/g)) if (!existsSync(join(ZIEL, m[1]))) fehler.push(`${seite}: Datei fehlt: ${m[1]}`);
}
for (const o of ['autoankauf', 'autoteile', ...ASSETS_OHNE.map((a) => join('assets', a))]) if (existsSync(join(ZIEL, o))) fehler.push(`Ordner gehört nicht hinein: ${o}`);
if (fehler.length) { console.error(fehler.join('\n')); process.exit(1); }

const mb = (dateien.reduce((summe, p) => summe + statSync(p).size, 0) / 1048576).toFixed(1);
console.log(`Upload-Ordner fertig: ${ZIEL}\n${dateien.length} Dateien, ${mb} MB. Den INHALT dieses Ordners in das Web-Verzeichnis bei one.com laden (auch .htaccess).`);
