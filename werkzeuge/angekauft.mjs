// Liste "Zuletzt angekauft": echte Ankäufe aus daten/angekauft.json.
// Die Autoankauf-Seite zeigt die 8 neuesten, jede Markenseite die 6 neuesten ihrer Marke, mit Link zur Markenseite.
// Das Werkzeug schreibt zwischen <!-- angekauft:start --> und <!-- angekauft:end -->. Ohne Einträge bleibt der Platz leer.
//
// Aufruf:   node werkzeuge/angekauft.mjs            prüft daten/angekauft.json und schreibt die Seiten
//           node werkzeuge/angekauft.mjs --pruefen  prüft nur, schreibt nichts
//
// Regeln (Kevin, 2026-10-29): nur echte Fahrzeuge mit eigenem Foto, keine Preise, keine Namen von Verkäufern,
// Kennzeichen auf dem Foto unkenntlich. Fotos liegen in assets/angekauft/.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('..', import.meta.url));

/** Marken mit eigener Seite unter autoankauf/<slug>/. */
export const MARKEN = { vw: 'VW', mercedes: 'Mercedes', bmw: 'BMW', audi: 'Audi', opel: 'Opel', ford: 'Ford', toyota: 'Toyota' };
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const PFLICHT = ['marke', 'modell', 'baujahr', 'zustand', 'monat', 'foto', 'fotoAlt'];
const VERBOTEN = /preis|betrag|euro|verkaeufer|verkäufer|kennzeichen|name/i;

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const monatText = (m) => { const [j, mo] = m.split('-').map(Number); return `${MONATE[mo - 1]} ${j}`; };

/** Prüft die Einträge und gibt eine Liste von Fehlern zurück (leer = alles gut). */
export function pruefe(eintraege, wurzel = WURZEL) {
  const fehler = [];
  if (!Array.isArray(eintraege)) return ['daten/angekauft.json muss eine Liste sein.'];
  const jahr = new Date().getFullYear();
  eintraege.forEach((e, i) => {
    const wo = `Eintrag ${i + 1}${e?.modell ? ` (${e.marke} ${e.modell})` : ''}`;
    for (const f of PFLICHT) if (e?.[f] === undefined || e[f] === '') fehler.push(`${wo}: "${f}" fehlt.`);
    for (const k of Object.keys(e ?? {})) if (VERBOTEN.test(k)) fehler.push(`${wo}: Feld "${k}" ist nicht erlaubt (keine Preise, keine Namen, keine Kennzeichen).`);
    for (const v of Object.values(e ?? {})) if (typeof v === 'string' && /€|\d+\s*euro/i.test(v)) fehler.push(`${wo}: Preisangabe gefunden ("${v}").`);
    if (e?.baujahr && !(Number.isInteger(e.baujahr) && e.baujahr >= 1950 && e.baujahr <= jahr + 1)) fehler.push(`${wo}: Baujahr "${e.baujahr}" ist keine Jahreszahl.`);
    if (e?.monat && !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.monat)) fehler.push(`${wo}: Monat bitte als JJJJ-MM, zum Beispiel 2026-10.`);
    if (e?.markeSlug && !MARKEN[e.markeSlug]) fehler.push(`${wo}: markeSlug "${e.markeSlug}" hat keine Seite (erlaubt: ${Object.keys(MARKEN).join(', ')}).`);
    if (e?.foto && !/^assets\/angekauft\/[a-z0-9-]+\.(webp|jpg|jpeg)$/.test(e.foto)) fehler.push(`${wo}: Foto bitte unter assets/angekauft/ mit Kleinbuchstaben, zum Beispiel assets/angekauft/2026-10-vw-golf-7.webp.`);
    else if (e?.foto && !existsSync(wurzel + e.foto)) fehler.push(`${wo}: Foto ${e.foto} fehlt.`);
  });
  return fehler;
}

/** HTML-Abschnitt für eine Seite. P ist der relative Pfad zur Wurzel, mitLink setzt den Link zur Markenseite. */
export function abschnitt(eintraege, P, { mitLink = true, titel = 'Zuletzt angekauft' } = {}) {
  if (!eintraege.length) return '';
  const karten = eintraege.map((e) => {
    const link = mitLink && e.markeSlug ? `<a href="${P}autoankauf/${e.markeSlug}/">Mehr zum ${esc(MARKEN[e.markeSlug])} Ankauf →</a>` : '';
    return `    <li class="reveal"><figure><img src="${P}${esc(e.foto)}" alt="${esc(e.fotoAlt)}" loading="lazy" decoding="async"><figcaption><strong>${esc(e.marke)} ${esc(e.modell)}</strong><span>Bj. ${esc(e.baujahr)} · ${esc(e.zustand)} · ${monatText(e.monat)}</span>${link}</figcaption></figure></li>`;
  });
  return `<section class="section" id="angekauft"><div class="wrap">
  <header class="section__head reveal"><p class="kicker">Echte Ankäufe</p><h2>${esc(titel)}</h2><p>Fahrzeuge, die wir zuletzt angekauft haben. Ohne Kennzeichen und ohne Preise.</p></header>
  <ul class="angekauft">
${karten.join('\n')}
  </ul>
</div></section>`;
}

/** Setzt den Abschnitt zwischen die Marken ein. */
export function einsetzen(html, inhalt) {
  const muster = /<!-- angekauft:start -->[\s\S]*?<!-- angekauft:end -->/;
  if (!muster.test(html)) throw new Error('Marken <!-- angekauft:start --> und <!-- angekauft:end --> fehlen.');
  return html.replace(muster, () => `<!-- angekauft:start -->\n${inhalt ? inhalt + '\n' : ''}<!-- angekauft:end -->`);
}

function haupt() {
  const nurPruefen = process.argv.includes('--pruefen');
  const eintraege = JSON.parse(readFileSync(WURZEL + 'daten/angekauft.json', 'utf8'));
  const fehler = pruefe(eintraege);
  if (fehler.length) { console.error('Nicht geschrieben, bitte korrigieren:\n- ' + fehler.join('\n- ')); process.exit(1); }
  const neu = [...eintraege].sort((a, b) => b.monat.localeCompare(a.monat));
  console.log(`${eintraege.length} Einträge geprüft, keine Fehler.`);
  if (nurPruefen) return;
  const seiten = [['autoankauf/index.html', '../', neu.slice(0, 8), { mitLink: true }]];
  for (const [slug, name] of Object.entries(MARKEN)) {
    seiten.push([`autoankauf/${slug}/index.html`, '../../', neu.filter((e) => e.markeSlug === slug).slice(0, 6), { mitLink: false, titel: `Zuletzt angekaufte ${name}` }]);
  }
  for (const [datei, P, liste, opt] of seiten) {
    const html = readFileSync(WURZEL + datei, 'utf8');
    writeFileSync(WURZEL + datei, einsetzen(html, abschnitt(liste, P, opt)));
    console.log(`${datei}: ${liste.length} Fahrzeuge`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) haupt();
