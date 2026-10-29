// Test-Umgebung ohne Netz: Jede Anfrage an die Testadresse beantwortet Playwright direkt mit der Datei aus dem Repo.
// Alles andere (WhatsApp, Google Maps, fremde Seiten) bekommt eine leere Antwort und geht nie ins Netz.
import { test as basis, expect } from '@playwright/test';
import { antwort } from './dateien.mjs';

export const ADRESSE = 'http://autoundhobby.test';

export const test = basis.extend({
  context: async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ADRESSE) return route.fulfill({ status: 204, body: '' });
      const { status, headers, body } = antwort(url.pathname);
      return route.fulfill({ status, headers, body });
    });
    await use(context);
  },
});
export { expect };
