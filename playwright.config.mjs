import { defineConfig, devices } from '@playwright/test';

// Browser-Tests (Standardablauf "Neue Website", Schritt 5). Aufruf: npm test
// oder einzeln: npx playwright test --project=chromium bzw. --project=webkit. Firefox startet auf Kevins Rechner nicht.
// Kein Server: e2e/umgebung.mjs beantwortet jede Anfrage direkt im Browser mit der Datei aus dem Repo (wie GitHub
// Pages). Über das lokale Netz blieben auf Kevins Rechner Antworten hängen, sobald mehrere Browser gleichzeitig luden.
// WhatsApp und Karte gehen in den Tests nie ins Netz.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://autoundhobby.test',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
});
