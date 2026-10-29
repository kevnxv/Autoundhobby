// Modellseiten und Modell-Finder für den Autoankauf.
// Aus daten/modelle/<marke>-<modell>.md (Texte aus dem alten Projekt, 2026-10-13) entstehen die Seiten
// autoankauf/<marke>/<modell>/. Kopf, Fußzeile, Formular, Ablauf und Kontakt kommen von der VW-Markenseite,
// damit alle Ankaufseiten gleich aussehen. Außerdem schreibt das Werkzeug:
//   - den Finder (Marke, Modell, Logos, Karten) auf autoankauf/index.html zwischen <!-- modelle:start/end -->
//   - die Modellkarten auf jede Markenseite zwischen <!-- modelle:start/end -->
//   - den Bildnachweis der Fotos ins Impressum zwischen <!-- bildnachweis:start/end -->
//   - sitemap.xml aus allen Seiten mit Canonical (Ersatzseiten der alten Adressen ausgenommen)
// Aufruf: node werkzeuge/modelle.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const W = fileURLToPath(new URL('..', import.meta.url));
const lies = (d) => readFileSync(W + d, 'utf8').replace(/\r\n/g, '\n');
const DOMAIN = 'https://autoundhobby.de/';

/** Reihenfolge im Finder. seite: Es gibt eine Markenseite. form: Wert im Feld "Marke" des Formulars. */
export const MARKEN = {
  vw: { name: 'VW', form: 'Volkswagen', seite: true },
  mercedes: { name: 'Mercedes', form: 'Mercedes-Benz', seite: true },
  bmw: { name: 'BMW', form: 'BMW', seite: true },
  audi: { name: 'Audi', form: 'Audi', seite: true },
  opel: { name: 'Opel', form: 'Opel', seite: true },
  ford: { name: 'Ford', form: 'Ford', seite: true },
  toyota: { name: 'Toyota', form: 'Toyota', seite: true },
  skoda: { name: 'Skoda', form: 'Skoda', seite: false },
  seat: { name: 'Seat', form: 'Seat', seite: false },
  mini: { name: 'Mini', form: 'Mini', seite: false },
  fiat: { name: 'Fiat', form: 'Fiat', seite: false },
};

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Markdown mit Kopfdaten ----------
function kopfdaten(text) {
  const daten = {};
  let liste = null, objekt = null;
  for (const zeile of text.split('\n')) {
    let m;
    if ((m = zeile.match(/^([a-zA-Z]+):\s*"(.*)"\s*$/))) { daten[m[1]] = m[2].replace(/\\"/g, '"'); liste = null; }
    else if ((m = zeile.match(/^([a-zA-Z]+):\s*$/))) { daten[m[1]] = liste = []; }
    else if ((m = zeile.match(/^  - (frage): "(.*)"\s*$/))) { objekt = { frage: m[2].replace(/\\"/g, '"') }; liste.push(objekt); }
    else if ((m = zeile.match(/^    (antwort): "(.*)"\s*$/))) { objekt.antwort = m[2].replace(/\\"/g, '"'); }
    else if ((m = zeile.match(/^  - "(.*)"\s*$/))) { liste.push(m[1].replace(/\\"/g, '"')); }
    else if (zeile.trim()) throw new Error(`Kopfdaten nicht verstanden: ${zeile}`);
  }
  return daten;
}

/** Alte Adressen der Astro-Seite auf die neue Struktur umschreiben. */
function linkZiel(url, P) {
  let m;
  if ((m = url.match(/^\/auto-verkaufen\/([a-z0-9-]+)\/([a-z0-9-]+)\/$/))) return `${P}autoankauf/${m[1]}/${m[2]}/`;
  if ((m = url.match(/^\/auto-verkaufen\/([a-z0-9-]+)\/$/))) return MARKEN[m[1]]?.seite ? `${P}autoankauf/${m[1]}/` : `${P}autoankauf/`;
  const fest = {
    '/auto-verkaufen/': 'autoankauf/', '/motorschaden-ankauf/': 'autoankauf/motorschaden/', '/unfallwagen-ankauf/': 'autoankauf/unfallwagen/',
    '/transporter-ankauf/': 'autoankauf/transporter-lkw/', '/mietwerkstatt/': 'mietwerkstatt/', '/preise/': 'mietwerkstatt/#preise',
    '/kontakt/': 'mietwerkstatt/#kontakt', '/lackierkabine-mieten/': 'mietwerkstatt/', '/autoteile/': 'autoteile/', '/': '',
  };
  if (url in fest) return P + fest[url];
  throw new Error(`Unbekannter Link im Modelltext: ${url}`);
}
const inline = (t, P) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${linkZiel(url.replace(/&amp;/g, '&'), P)}">${text}</a>`);

function markdown(text, P) {
  const html = [];
  let absatz = [], liste = null;
  const schliesse = () => {
    if (absatz.length) { html.push(`<p>${inline(absatz.join(' '), P)}</p>`); absatz = []; }
    if (liste) { html.push(`<ul class="equip equip--1">${liste.map((l) => `<li>${inline(l, P)}</li>`).join('')}</ul>`); liste = null; }
  };
  for (const zeile of text.split('\n')) {
    let m;
    if (!zeile.trim()) schliesse();
    else if ((m = zeile.match(/^(#{2,3}) (.+)$/))) { schliesse(); html.push(`<h${m[1].length}>${inline(m[2], P)}</h${m[1].length}>`); }
    else if ((m = zeile.match(/^[-*] (.+)$/))) { if (absatz.length) schliesse(); (liste ??= []).push(m[1]); }
    else if (liste && /^\s+\S/.test(zeile)) liste[liste.length - 1] += ' ' + zeile.trim();
    else { if (liste) schliesse(); absatz.push(zeile.trim()); }
  }
  schliesse();
  return html.join('\n  ');
}

// ---------- Bausteine aus der VW-Markenseite ----------
const VW = lies('autoankauf/vw/index.html');
const tiefer = (t) => t.replace(/(href|src)="\.\.\/\.\.\//g, '$1="../../../');
const stueck = (muster, was) => { const m = VW.match(muster); if (!m) throw new Error(`Baustein fehlt in der VW-Seite: ${was}`); return m[0]; };
const KOPF_REST = tiefer(stueck(/<meta name="theme-color"[\s\S]*?<link rel="stylesheet"[^>]*>/, 'Kopf'));
const KOPFZEILE = tiefer(stueck(/<body class="page-lp">[\s\S]*?<main id="main">/, 'Kopfzeile'));
const TICKS = stueck(/<ul class="ticks">[\s\S]*?<\/ul>/, 'Häkchen');
const CTA = tiefer(stueck(/<div class="cta">\s*<a class="btn btn--accent btn--lg"[\s\S]*?<\/div>/, 'Knöpfe im Kopf'));
const FORM = tiefer(stueck(/<form class="leadform[\s\S]*?<\/form>/, 'Formular'));
const ABLAUF = stueck(/<section class="section" id="ablauf">[\s\S]*?<\/section>/, 'Ablauf');
const KONTAKT = tiefer(stueck(/<section id="kontakt"[\s\S]*?<\/section>/, 'Kontakt'));
const FUSS = tiefer(stueck(/<\/main>[\s\S]*<\/html>/, 'Fußzeile'));
const DEALER = JSON.parse(stueck(/<script type="application\/ld\+json">(\{"@context": "https:\/\/schema\.org", "@type": "AutoDealer"[\s\S]*?)<\/script>/, 'JSON-LD').replace(/^<script[^>]*>|<\/script>$/g, ''));

const logo = (slug) => {
  const datei = W + `daten/marken-logos/${slug}.svg`;
  if (!existsSync(datei)) return '';
  const pfad = readFileSync(datei, 'utf8').match(/<path d="([^"]+)"/)[1];
  return `<svg class="marke__logo" viewBox="0 0 24 24" aria-hidden="true"><path d="${pfad}"/></svg>`;
};

// ---------- Daten laden ----------
const FOTOS = JSON.parse(lies('daten/modellfotos.json'));
const MODELLE = readdirSync(W + 'daten/modelle').filter((f) => f.endsWith('.md')).map((datei) => {
  const text = lies('daten/modelle/' + datei);
  const [, kopf, rumpf] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const d = kopfdaten(kopf);
  if (!MARKEN[d.markeSlug]) throw new Error(`${datei}: Marke ${d.markeSlug} fehlt in MARKEN`);
  return { ...d, rumpf, schluessel: `${d.markeSlug}-${d.modellSlug}`, pfad: `autoankauf/${d.markeSlug}/${d.modellSlug}/` };
});
const reihenfolge = Object.keys(MARKEN);
MODELLE.sort((a, b) => reihenfolge.indexOf(a.markeSlug) - reihenfolge.indexOf(b.markeSlug) || a.modell.localeCompare(b.modell, 'de'));
const nachSchluessel = Object.fromEntries(MODELLE.map((m) => [m.modellSlug, m]));

// ---------- Modellseite ----------
function modellseite(m) {
  const P = '../../../';
  const marke = MARKEN[m.markeSlug];
  const foto = FOTOS[m.schluessel];
  const url = DOMAIN + m.pfad;
  const titelText = m.title.replace(/ \| Autohobby$/, '');
  const title = titelText.length + 15 <= 62 ? `${titelText} | Auto + Hobby` : titelText;
  const markeKrume = marke.seite ? `<a href="${P}autoankauf/${m.markeSlug}/">${esc(marke.name)}</a>` : `<span>${esc(marke.name)}</span>`;
  const dealer = { ...DEALER, url, makesOffer: { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Ankauf ${marke.name} ${m.modell}`, areaServed: 'Nordrhein-Westfalen' } } };
  const krumen = [['Start', DOMAIN], ['Autoankauf', DOMAIN + 'autoankauf/'], ...(marke.seite ? [[marke.name, DOMAIN + `autoankauf/${m.markeSlug}/`]] : []), [m.modell, url]];
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: krumen.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
  const hintergrund = foto ? `${P}assets/modelle/${m.schluessel}.webp` : `${P}assets/werkstatt/lackierkabine.webp`;
  const form = FORM
    .replace(/data-prefill-marke="[^"]*"/, `data-prefill-marke="${esc(marke.form)}" data-prefill-modell="${esc(m.modell)}"`)
    .replace(/data-name="[^"]*"/, 'data-name="Autoankauf-Anfrage"');
  const rechts = foto
    ? `<figure class="modellfoto"><img src="${P}assets/modelle/${m.schluessel}.webp" alt="${esc(foto.motiv)}" width="1200" height="800" loading="lazy" decoding="async"><figcaption>Beispielfoto, kein Fahrzeug aus unserem Betrieb. Foto: ${esc(foto.urheber)}, ${esc(foto.lizenz)}, <a href="${esc(foto.quelle)}" target="_blank" rel="noopener">Wikimedia Commons<span class="sr-only"> (öffnet in neuem Fenster)</span></a>${foto.bearbeitet ? `, ${esc(foto.bearbeitet)}` : ''}.</figcaption></figure>`
    : `<div class="modellplakette">${logo(m.markeSlug)}<p>${esc(marke.name)}</p><p class="modellplakette__name">${esc(m.modell)}</p></div>`;
  const verwandte = (m.verwandte || []).map((s) => nachSchluessel[s]).filter(Boolean);
  const geschwister = MODELLE.filter((x) => x.markeSlug === m.markeSlug && x !== m).slice(0, 8);
  const links = [...new Map([...geschwister, ...verwandte].map((x) => [x.pfad, x])).values()];
  const html = `<!doctype html>
<html lang="de">
<head><meta name="robots" content="noindex,nofollow">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${esc(m.description)}">

${KOPF_REST.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`).replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.description)}">`).replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)}
<script type="application/ld+json">${JSON.stringify(dealer)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
</head>
${KOPFZEILE}

<!-- Erzeugt von werkzeuge/modelle.mjs aus daten/modelle/${m.schluessel}.md. Änderungen dort machen. -->
<section class="lp-hero hero--photo">
  <div class="hero__bg" aria-hidden="true"><img src="${hintergrund}" alt="" width="1200" height="800"></div>
  <div class="wrap lp-hero__inner">
    <div class="lp-hero__copy">
      <nav class="crumbs" aria-label="Brotkrumen"><a href="${P}">Start</a> / <a href="${P}autoankauf/">Autoankauf</a> / ${markeKrume} / <span>${esc(m.modell)}</span></nav>
      <h1>${esc(marke.name)} ${esc(m.modell)} verkaufen – <span class="hl">auch mit Schaden</span></h1>
      <p class="lead">${esc(m.einleitung)}</p>
      ${TICKS}
      ${CTA}
    </div>
    ${form}
  </div>
</section>

<section class="section section--alt" id="baureihen"><div class="wrap split">
  <div class="reveal"><p class="kicker">${esc(marke.name)} ${esc(m.modell)} Ankauf</p><h2>Diese Baureihen kaufen wir an</h2>
  <ul class="equip">${m.baureihen.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
  <p>Auch mit Mängeln, Unfallschaden oder Motorschaden. Fragen Sie auch mit einer Variante an, die hier nicht steht.</p>
  <a class="btn btn--accent" href="#angebot">Angebot anfordern</a></div>
  <div class="reveal">${rechts}</div>
</div></section>

<section class="section"><div class="wrap narrow textblock reveal">
  ${markdown(m.rumpf.trim(), P)}
</div></section>

${ABLAUF}

<section class="section section--alt" id="faq"><div class="wrap narrow">
  <header class="section__head reveal"><p class="kicker">FAQ</p><h2>Fragen zum ${esc(marke.name)} ${esc(m.modell)}</h2></header>
  <div class="faq">
${(m.faq || []).map((f) => `    <details class="reveal"><summary>${esc(f.frage)}</summary><p>${inline(f.antwort, P)}</p></details>`).join('\n')}
  </div>
</div></section>

<section class="section"><div class="wrap">
  <div class="band reveal"><div><h2>${esc(marke.name)} ${esc(m.modell)} verkaufen?</h2><p>Rufen Sie an: 0178 4444510. Am Telefon ist der Inhaber.</p></div>
  <div class="cta"><a class="btn btn--dark btn--lg" href="tel:+491784444510">0178 4444510</a><a class="btn btn--dark-ghost btn--lg" href="#angebot">Angebot anfordern</a></div></div>
  <nav class="related" aria-label="Weitere Modelle">${marke.seite ? `<a href="${P}autoankauf/${m.markeSlug}/">Alle ${esc(marke.name)} Modelle</a>` : ''}${links.map((x) => `<a href="${P}${x.pfad}">${esc(MARKEN[x.markeSlug].name)} ${esc(x.modell)} verkaufen</a>`).join('')}<a href="${P}autoankauf/">Alle Marken</a></nav>
</div></section>
${KONTAKT}
${FUSS}
`;
  mkdirSync(W + m.pfad, { recursive: true });
  writeFileSync(W + m.pfad + 'index.html', html);
}

// ---------- Karten, Finder, Markenseiten ----------
const karte = (m, P) => {
  const foto = FOTOS[m.schluessel];
  const bild = foto
    ? `<img src="${P}assets/modelle/${m.schluessel}-480.webp" alt="" width="480" height="320" loading="lazy" decoding="async">`
    : `<span class="modellkarte__ohne" aria-hidden="true">${logo(m.markeSlug) || esc(MARKEN[m.markeSlug].name)}</span>`;
  const baureihen = (m.baureihen || []).slice(0, 2).join(', ');
  return `<li data-marke="${m.markeSlug}" data-modell="${esc(m.modell)}"><a class="modellkarte" href="${P}${m.pfad}"><span class="modellkarte__bild">${bild}</span><span class="modellkarte__text"><span class="modellkarte__marke">${esc(MARKEN[m.markeSlug].name)}</span><strong>${esc(m.modell)}</strong><span class="modellkarte__reihen">${esc(baureihen)}</span></span></a></li>`;
};

function finder() {
  const P = '../';
  const marken = Object.entries(MARKEN).filter(([slug]) => MODELLE.some((m) => m.markeSlug === slug));
  return `<section class="section" id="modelle"><div class="wrap">
  <header class="section__head reveal"><p class="kicker">Modell finden</p><h2>Welches Auto möchten Sie verkaufen?</h2><p>Wählen Sie Marke und Modell. Auf der Modellseite stehen die Baureihen, die Themen, nach denen wir fragen, und das Formular mit Ihrem Modell.</p></header>
  <form class="finder reveal" data-finder hidden>
    <label>Marke<select name="marke"><option value="">Marke wählen</option>${marken.map(([s, x]) => `<option value="${s}">${esc(x.name)}</option>`).join('')}</select></label>
    <label>Modell<select name="modell" disabled><option value="">Erst Marke wählen</option></select></label>
    <button type="submit" class="btn btn--accent">Zum Modell</button>
  </form>
  <ul class="markenreihe reveal" aria-label="Marken">${marken.map(([s, x]) => `<li><a class="marke" href="${x.seite ? `${P}autoankauf/${s}/` : '#modelle'}" data-marke-filter="${s}">${logo(s)}<span>${esc(x.name)}</span></a></li>`).join('')}</ul>
  <ul class="modellkarten" data-modellkarten>
    ${MODELLE.map((m) => karte(m, P)).join('\n    ')}
  </ul>
  <p class="fineprint">Die Fotos zeigen Beispiele der Modelle von Wikimedia Commons, keine Fahrzeuge aus unserem Betrieb. Urheber und Lizenzen stehen im <a href="${P}impressum/#bildnachweis">Bildnachweis</a>. Markennamen und Logos gehören ihren Inhabern.</p>
</div></section>`;
}

function markenModelle(slug) {
  const P = '../../';
  const liste = MODELLE.filter((m) => m.markeSlug === slug);
  if (!liste.length) return '';
  return `<section class="section" id="modelle"><div class="wrap">
  <header class="section__head reveal"><p class="kicker">Modelle</p><h2>${esc(MARKEN[slug].name)} Modelle verkaufen</h2><p>Zu diesen Modellen gibt es eine eigene Seite mit Baureihen und den Themen, nach denen wir fragen.</p></header>
  <ul class="modellkarten">
    ${liste.map((m) => karte(m, P)).join('\n    ')}
  </ul>
</div></section>`;
}

function bildnachweis() {
  const zeilen = MODELLE.filter((m) => FOTOS[m.schluessel]).map((m) => {
    const f = FOTOS[m.schluessel];
    return `<li>${esc(MARKEN[m.markeSlug].name)} ${esc(m.modell)}: ${esc(f.urheber)}, ${esc(f.lizenz)}${f.lizenzUrl ? ` (<a href="${esc(f.lizenzUrl)}" target="_blank" rel="noopener">Lizenz</a>)` : ''}, <a href="${esc(f.quelle)}" target="_blank" rel="noopener">Quelle</a>${f.bearbeitet ? `, ${esc(f.bearbeitet)}` : ''}. Verkleinert.</li>`;
  });
  return `<h2 id="bildnachweis">Bildnachweis</h2>
<p>Die Fotos auf den Modellseiten sind Beispielfotos des jeweiligen Modells von Wikimedia Commons, keine Fahrzeuge aus unserem Betrieb.</p>
<ul>${zeilen.join('')}</ul>
<p>Markenlogos: simple-icons (CC0), der Mercedes-Stern ist selbst nachgezeichnet. Markennamen und Logos gehören ihren jeweiligen Inhabern.</p>`;
}

function setze(datei, name, inhalt, einfuegen) {
  let html = lies(datei);
  const muster = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`);
  if (!muster.test(html)) {
    const neu = einfuegen(html, `<!-- ${name}:start -->\n<!-- ${name}:end -->`);
    if (neu === html) throw new Error(`${datei}: Stelle für ${name} nicht gefunden`);
    html = neu;
  }
  writeFileSync(W + datei, html.replace(muster, () => `<!-- ${name}:start -->\n${inhalt}\n<!-- ${name}:end -->`));
}

// ---------- Sitemap ----------
function sitemap() {
  const dateien = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '*.html'], { cwd: W, encoding: 'utf8' }).trim().split('\n');
  const heute = new Date().toISOString().slice(0, 10);
  const orte = dateien.filter((d) => !d.startsWith('e2e/')).map((d) => [d, lies(d)])
    .filter(([, h]) => !/http-equiv="refresh"/.test(h) && /rel="canonical"/.test(h))
    .map(([d, h]) => h.match(/<link rel="canonical" href="([^"]+)"/)[1])
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  writeFileSync(W + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${orte.map((o) => `  <url><loc>${o}</loc><lastmod>${heute}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  return orte.length;
}

// ---------- Ablauf ----------
for (const m of MODELLE) modellseite(m);
setze('autoankauf/index.html', 'modelle', finder(), (h, marken) => h.replace(/(\n<section class="section" id="ablauf">)/, `\n${marken}\n$1`));
for (const [slug, x] of Object.entries(MARKEN)) {
  if (!x.seite) continue;
  setze(`autoankauf/${slug}/index.html`, 'modelle', markenModelle(slug), (h, marken) => h.replace(/(\n<!-- angekauft:start -->)/, `\n${marken}\n$1`));
}
setze('impressum/index.html', 'bildnachweis', bildnachweis(), (h, marken) => h.replace(/(<h2>Markennamen<\/h2>[\s\S]*?)(<\/div><\/section>)/, `$1${marken}\n$2`));
console.log(`${MODELLE.length} Modellseiten geschrieben, ${Object.keys(FOTOS).length} mit Foto. Sitemap: ${sitemap()} Adressen.`);
