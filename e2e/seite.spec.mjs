import { test, expect } from './umgebung.mjs';
import { readFileSync } from 'node:fs';
import { pruefe, abschnitt, einsetzen } from '../werkzeuge/angekauft.mjs';

// Browser-Tests: alle Seiten laden, Navigation, Formulare, Handy, Ersatzseiten der alten Adressen.
// WhatsApp wird abgefangen: Am Schreibtisch ersetzt ein Stub window.open, am Handy beantwortet die Route wa.me selbst.

// Alle echten Seiten stehen in der Sitemap (werkzeuge/modelle.mjs schreibt sie), die Ersatzseiten der alten Adressen nicht.
const SITEMAP = [...readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>https:\/\/autoundhobby\.de([^<]+)<\/loc>/g)].map((m) => m[1]);
const SEITEN = SITEMAP;

const ALTE_ADRESSEN = {
  '/kfz-ankauf/': '/autoankauf/',
  '/preisliste/': '/mietwerkstatt/#preise',
  '/preise/': '/mietwerkstatt/#preise',
  '/bildergalerie/': '/mietwerkstatt/',
  '/bilder/': '/mietwerkstatt/',
  '/cookie-richtlinie-eu/': '/datenschutz/',
  '/wegbeschreibung/': '/mietwerkstatt/#kontakt',
  '/hello-world/': '/',
  '/hello-world/feed/': '/',
  '/feed/': '/',
  '/category/uncategorized/': '/',
  '/author/moinier/': '/',
};

function fehlerSammler(page) {
  const fehler = [];
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('pageerror', (e) => fehler.push(e.message));
  return fehler;
}
const ueberlauf = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const kaputteBilder = (page) => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')));
const pfadMitAnker = (page) => { const u = new URL(page.url()); return u.pathname + u.hash; };

test.describe('Am Schreibtisch', () => {
  for (const pfad of SEITEN) {
    test(`${pfad} lädt ohne Fehler`, async ({ page }) => {
      const fehler = fehlerSammler(page);
      const antwort = await page.goto(pfad);
      expect(antwort?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await ueberlauf(page)).toBeLessThanOrEqual(0);
      expect(await kaputteBilder(page)).toEqual([]);
      expect(fehler).toEqual([]);
    });
  }

  test('Startseite: vier Kategorien führen auf ihre Seiten, Anruf oben', async ({ page }) => {
    test.slow(); // fünf Seitenaufrufe, WebKit braucht dafür neben anderen Tests über 30 s
    await page.goto('/');
    await expect(page.locator('.picker__top a[href="tel:+491784444510"]')).toBeVisible();
    for (const [name, ziel] of [['Mietwerkstatt', '/mietwerkstatt/'], ['Autoankauf', '/autoankauf/'], ['Reifenwechsel', '/mietwerkstatt/#reifenwechsel'], ['Autoteile', '/autoteile/']]) {
      await page.goto('/');
      await page.locator('a.kat', { hasText: name }).click();
      await expect.poll(() => pfadMitAnker(page)).toBe(ziel);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('Kategorie-Leiste wechselt zwischen den Bereichen und zurück zur Auswahl', async ({ page }) => {
    await page.goto('/mietwerkstatt/');
    const leiste = page.getByRole('navigation', { name: 'Kategorien' });
    for (const [name, ziel] of [['Autoankauf', '/autoankauf/'], ['Autoteile', '/autoteile/'], ['Mietwerkstatt', '/mietwerkstatt/']]) {
      await leiste.getByRole('link', { name }).click();
      await expect.poll(() => pfadMitAnker(page)).toBe(ziel);
    }
    await leiste.getByRole('link', { name: 'Alle Kategorien' }).click();
    await expect.poll(() => pfadMitAnker(page)).toBe('/');
  });

  test('Mietwerkstatt-Formular: Pflichtfelder werden geprüft, dann öffnet WhatsApp mit der Anfrage', async ({ page }) => {
    await page.addInitScript(() => { window.__wa = []; window.open = (url) => { window.__wa.push(String(url)); return null; }; });
    await page.goto('/mietwerkstatt/#kontakt');
    const form = page.locator('#bookingForm');
    await form.getByRole('button', { name: /Per WhatsApp senden/ }).click();
    await expect(form.locator('.form__status')).toContainText('Pflichtfelder');
    expect(await page.evaluate(() => window.__wa.length)).toBe(0);

    await form.locator('select[name="anliegen"]').selectOption('Lackierkabine');
    await form.locator('input[name="telefon"]').fill('0170 1234567');
    await form.locator('input[name="datenschutz"]').check();
    await form.getByRole('button', { name: /Per WhatsApp senden/ }).click();
    const urls = await page.evaluate(() => window.__wa);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/wa\.me\/491784444510\?text=/);
    const text = decodeURIComponent(urls[0].split('text=')[1]);
    expect(text).toContain('Lackierkabine');
    expect(text).toContain('0170 1234567');
    await expect(form.locator('.form__status')).toContainText('Rufen Sie an');
  });

  test('Teileanfrage: Ausgefülltes Formular öffnet WhatsApp', async ({ page }) => {
    await page.addInitScript(() => { window.__wa = []; window.open = (url) => { window.__wa.push(String(url)); return null; }; });
    await page.goto('/autoteile/');
    const form = page.locator('form.js-form');
    await form.locator('input[name="telefon"]').fill('0170 7654321');
    await form.locator('textarea[name="nachricht"]').fill('VW Golf 7, Bj. 2015, Außenspiegel links');
    await form.locator('input[name="datenschutz"]').check();
    await form.locator('button[type="submit"]').click();
    const urls = await page.evaluate(() => window.__wa);
    expect(urls).toHaveLength(1);
    expect(decodeURIComponent(urls[0])).toContain('Außenspiegel links');
  });

  test('Mietwerkstatt: Preise ohne doppelte Preiskarten, Tippfehler behoben', async ({ page }) => {
    await page.goto('/mietwerkstatt/');
    await expect(page.locator('.price-card')).toHaveCount(0);
    await expect(page.locator('table.prices')).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('selbst ?');
    expect(html).not.toContain('incl. MWST');
  });

  for (const [alt, neu] of Object.entries(ALTE_ADRESSEN)) {
    test(`Alte Adresse ${alt} leitet weiter auf ${neu}`, async ({ page }) => {
      await page.goto(alt);
      await expect.poll(() => pfadMitAnker(page)).toBe(neu);
    });
  }

  test('Sitemap und Canonical passen zusammen, Sperre ist überall gleich', async ({ page }) => {
    test.setTimeout(240_000); // alle Seiten der Sitemap nacheinander
    const orte = SITEMAP.map((p) => `https://autoundhobby.de${p}`);
    expect(orte.length).toBeGreaterThanOrEqual(72);
    const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
    const gesperrt = /Disallow:\s*\/\s*$/m.test(robots);
    for (const pfad of SEITEN) {
      await page.goto(pfad);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://autoundhobby.de${pfad}`);
      expect(orte).toContain(canonical);
      // Vorschau: robots.txt sperrt und jede Seite hat noindex. Nach dem Livegang: beides weg.
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(gesperrt ? 1 : 0);
    }
  });

  test('Modell-Finder: Marke und Modell wählen führt zur Modellseite mit vorbelegtem Formular', async ({ page }) => {
    await page.goto('/autoankauf/');
    const finder = page.locator('[data-finder]');
    await expect(finder).toBeVisible();
    await expect(finder.locator('select[name="modell"]')).toBeDisabled();
    await finder.locator('select[name="marke"]').selectOption('vw');
    await finder.locator('select[name="modell"]').selectOption({ label: 'Golf' });
    await finder.getByRole('button', { name: 'Zum Modell' }).click();
    await expect(page).toHaveURL('/autoankauf/vw/golf/');
    await expect(page.locator('h1')).toContainText('VW Golf verkaufen');
    await expect(page.locator('#angebot input[name="marke"]')).toHaveValue('Volkswagen');
    await expect(page.locator('#angebot input[name="modell"]')).toHaveValue('Golf');
  });

  test('Markenreihe filtert die Modellkarten', async ({ page }) => {
    await page.goto('/autoankauf/');
    const karten = page.locator('[data-modellkarten] > li');
    const alle = await karten.count();
    expect(alle).toBe(55);
    await page.locator('[data-marke-filter="toyota"]').click();
    await expect(page.locator('[data-marke-filter="toyota"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-modellkarten] > li:visible')).toHaveCount(27);
    await page.locator('[data-marke-filter="toyota"]').click();
    await expect(page.locator('[data-modellkarten] > li:visible')).toHaveCount(alle);
  });

  test('Modellseite mit Foto nennt Urheber und Lizenz, das Impressum führt den Bildnachweis', async ({ page }) => {
    await page.goto('/autoankauf/toyota/corolla/');
    await expect(page.locator('.modellfoto figcaption')).toContainText('Beispielfoto');
    await expect(page.locator('.modellfoto figcaption a[href*="commons.wikimedia.org"]')).toHaveCount(1);
    await page.goto('/impressum/');
    await expect(page.locator('#bildnachweis')).toBeVisible();
    await expect(page.locator('#bildnachweis + p + ul li')).toHaveCount(27);
  });

  test('Ankaufseiten unterscheiden sich im Text (keine Brückenseiten)', async ({ page }) => {
    const woerter = async (pfad) => {
      await page.goto(pfad);
      return page.evaluate(() => {
        const main = document.querySelector('main').cloneNode(true);
        main.querySelectorAll('form, script').forEach((e) => e.remove());
        const w = main.textContent.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
        return [...new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(' ')))];
      });
    };
    const basis = new Set(await woerter('/autoankauf/motorschaden/'));
    for (const pfad of ['/autoankauf/', '/autoankauf/unfallwagen/', '/autoankauf/vw/', '/autoankauf/vw/golf/', '/autoankauf/toyota/corolla/']) {
      const andere = await woerter(pfad);
      const gleich = andere.filter((x) => basis.has(x)).length / Math.min(andere.length, basis.size);
      expect(gleich, pfad).toBeLessThan(0.5);
    }
  });
});

test.describe('Zuletzt angekauft (Werkzeug)', () => {
  const golf = { marke: 'VW', markeSlug: 'vw', modell: 'Golf 7', baujahr: 2014, zustand: 'Motorschaden', monat: '2026-10', foto: 'assets/angekauft/2026-10-vw-golf-7.webp', fotoAlt: 'VW Golf 7 in der Halle' };

  test('ohne Einträge bleibt der Platz leer, mit Eintrag erscheint die Karte mit Link', () => {
    expect(abschnitt([], '../')).toBe('');
    const html = abschnitt([golf], '../');
    expect(html).toContain('<strong>VW Golf 7</strong>');
    expect(html).toContain('Bj. 2014 · Motorschaden · Oktober 2026');
    expect(html).toContain('href="../autoankauf/vw/"');
    expect(html).not.toContain('€');
    expect(einsetzen('a<!-- angekauft:start -->alt<!-- angekauft:end -->b', '')).toBe('a<!-- angekauft:start -->\n<!-- angekauft:end -->b');
  });

  test('Preise, Namen und fehlende Fotos werden abgelehnt', async () => {
    // Eigener Beispielordner mit Foto, damit der Test nicht von echten Einträgen abhängt.
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const wurzel = mkdtempSync(`${tmpdir()}/angekauft-`) + '/';
    mkdirSync(wurzel + 'assets/angekauft', { recursive: true });
    writeFileSync(wurzel + golf.foto, 'x');
    expect(pruefe([golf], wurzel)).toEqual([]);
    expect(pruefe([{ ...golf, foto: 'assets/werkstatt/halle.webp' }], wurzel).join()).toContain('unter assets/angekauft/');
    expect(pruefe([{ ...golf, preis: 1500 }], wurzel).join()).toContain('nicht erlaubt');
    expect(pruefe([{ ...golf, zustand: 'für 1500 €' }], wurzel).join()).toContain('Preisangabe');
    expect(pruefe([{ ...golf, foto: 'assets/angekauft/fehlt.webp' }], wurzel).join()).toContain('fehlt');
  });

  test('die Marken für die Liste stehen auf Ankauf- und Markenseiten', () => {
    for (const datei of ['autoankauf/index.html', 'autoankauf/vw/index.html', 'autoankauf/toyota/index.html']) {
      expect(readFileSync(new URL(`../${datei}`, import.meta.url), 'utf8'), datei).toContain('<!-- angekauft:start -->');
    }
  });
});

test.describe('Am Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const pfad of ['/', '/mietwerkstatt/', '/autoankauf/', '/autoankauf/vw/', '/autoteile/', '/impressum/']) {
    test(`${pfad} ohne seitlichen Überlauf`, async ({ page }) => {
      await page.goto(pfad);
      expect(await ueberlauf(page)).toBeLessThanOrEqual(0);
    });
  }

  test('Tippziele im Kopf und in der Kategorie-Leiste sind mindestens 44 px hoch', async ({ page }) => {
    for (const pfad of ['/', '/mietwerkstatt/']) {
      await page.goto(pfad);
      const klein = await page.evaluate(() =>
        [...document.querySelectorAll('header a, header button, .catbar a, .picker__top a')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; })
          .map((e) => `${e.textContent.trim() || e.getAttribute('aria-label')} (${Math.round(e.getBoundingClientRect().height)} px)`),
      );
      expect(klein, pfad).toEqual([]);
    }
  });

  test('Startseite: Anruf-Knopf oben sichtbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.picker__top a[href="tel:+491784444510"]')).toBeInViewport();
  });

  test('Startseite: alle vier Kategorien liegen im ersten Bildschirm', async ({ page }) => {
    await page.goto('/');
    const kategorien = page.locator('a.kat');
    await expect(kategorien).toHaveCount(4);
    for (const kat of await kategorien.all()) await expect(kat).toBeInViewport({ ratio: 1 });
  });

  test('Formular am Handy wechselt direkt zu WhatsApp', async ({ page }) => {
    let geoeffnet = '';
    await page.route('https://wa.me/**', (route) => { geoeffnet = route.request().url(); return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>' }); });
    await page.goto('/mietwerkstatt/#kontakt');
    const form = page.locator('#bookingForm');
    await form.locator('input[name="telefon"]').fill('0170 1234567');
    await form.locator('input[name="datenschutz"]').check();
    await form.getByRole('button', { name: /Per WhatsApp senden/ }).click();
    await expect.poll(() => geoeffnet).toMatch(/^https:\/\/wa\.me\/491784444510\?text=/);
  });
});
