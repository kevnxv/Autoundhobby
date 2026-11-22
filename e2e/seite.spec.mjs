import { test, expect } from './umgebung.mjs';
import { readFileSync } from 'node:fs';
import { pruefe, abschnitt, einsetzen } from '../werkzeuge/angekauft.mjs';

// Browser-Tests: alle Seiten laden, Navigation, Formulare, Handy, Ersatzseiten der alten Adressen.
// WhatsApp wird abgefangen: Am Schreibtisch ersetzt ein Stub window.open, am Handy beantwortet die Route wa.me selbst.

// Alle echten Seiten stehen in der Sitemap (werkzeuge/modelle.mjs schreibt sie), die Ersatzseiten der alten Adressen nicht.
const SITEMAP = [...readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>https:\/\/autoundhobby\.de([^<]+)<\/loc>/g)].map((m) => m[1]);
const SEITEN = SITEMAP;

const ALTE_ADRESSEN = {
  // Seit 2026-11-22 zeigt die Seite nur die Mietwerkstatt, alle anderen Bereiche leiten dorthin.
  '/': '/mietwerkstatt/',
  '/autoankauf/': '/mietwerkstatt/',
  '/autoankauf/vw/golf/': '/mietwerkstatt/',
  '/autoteile/': '/mietwerkstatt/',
  '/kfz-ankauf/': '/mietwerkstatt/',
  '/preisliste/': '/mietwerkstatt/#preise',
  '/preise/': '/mietwerkstatt/#preise',
  '/bildergalerie/': '/mietwerkstatt/',
  '/bilder/': '/mietwerkstatt/',
  '/cookie-richtlinie-eu/': '/datenschutz/',
  '/wegbeschreibung/': '/mietwerkstatt/#kontakt',
  '/hello-world/': '/mietwerkstatt/',
  '/hello-world/feed/': '/mietwerkstatt/',
  '/feed/': '/mietwerkstatt/',
  '/category/uncategorized/': '/mietwerkstatt/',
  '/author/moinier/': '/mietwerkstatt/',
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


  test('Überschrift springt nicht um: Bebas Neue wartet und wird vorab geholt', async ({ page }) => {
    // Mit swap erschien die Überschrift erst in der viel breiteren Ersatzschrift und sprang dann um (2026-10-29).
    expect(readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8')).toMatch(/font-family:"Bebas Neue";[^}]*font-display:block/);
    await page.goto('/mietwerkstatt/');
    await expect(page.locator('link[rel="prefetch"][href$="/assets/fonts/bebas-neue-400.woff2"]')).toHaveCount(1);
  });

  test('Keine Links mehr auf Autoankauf, Autoteile oder Reifenwechsel', async ({ page }) => {
    for (const pfad of SEITEN) {
      await page.goto(pfad);
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /autoankauf|autoteile|reifenwechsel/.test(h)));
      expect(links, pfad).toEqual([]);
    }
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

  test('Mietwerkstatt: Preise ohne doppelte Preiskarten, Tippfehler behoben', async ({ page }) => {
    await page.goto('/mietwerkstatt/');
    await expect(page.locator('.price-card')).toHaveCount(0);
    // Aufbau wie auf der alten Seite: drei Tabellen mit Sprungmarken, Transporter-Plätze für 20 €.
    await expect(page.locator('table.prices caption')).toHaveText(['Plätze', 'Werkzeug und Entsorgung', 'Stellplätze']);
    for (const ziel of ['#plaetze', '#werkzeug', '#stellplaetze', '#bedingungen']) await expect(page.locator(ziel)).toHaveCount(1);
    await expect(page.locator('#plaetze tr', { hasText: 'Hebebühnenplatz für Transporter' })).toContainText('20,00 €');
    await expect(page.locator('#faq details')).toHaveCount(10);
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
    expect(orte.length).toBe(3);
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

});

test.describe('Am Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const pfad of ['/mietwerkstatt/', '/impressum/', '/datenschutz/']) {
    test(`${pfad} ohne seitlichen Überlauf`, async ({ page }) => {
      await page.goto(pfad);
      expect(await ueberlauf(page)).toBeLessThanOrEqual(0);
    });
  }

  test('Tippziele im Kopf sind mindestens 44 px hoch', async ({ page }) => {
    for (const pfad of ['/mietwerkstatt/']) {
      await page.goto(pfad);
      const klein = await page.evaluate(() =>
        [...document.querySelectorAll('header a, header button, .catbar a, .picker__top a')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; })
          .map((e) => `${e.textContent.trim() || e.getAttribute('aria-label')} (${Math.round(e.getBoundingClientRect().height)} px)`),
      );
      expect(klein, pfad).toEqual([]);
    }
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
