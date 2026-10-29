// Liest das Repo einmal ein und beantwortet Pfade wie GitHub Pages: Ordner mit index.html,
// /pfad ohne Schrägstrich bekommt eine 301 auf /pfad/. Genutzt von den Tests (ohne Netz) und von e2e/server.mjs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
const typen = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
const auslassen = new Set(['.git', 'node_modules', 'e2e', 'test-results', 'playwright-report', '.claude']);

const dateien = new Map();
const ordner = new Set(['/']);
(function lies(dir) {
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    if (auslassen.has(eintrag.name)) continue;
    const voll = join(dir, eintrag.name);
    const pfad = '/' + relative(wurzel, voll).split(sep).join('/');
    if (eintrag.isDirectory()) { ordner.add(pfad + '/'); lies(voll); }
    else dateien.set(pfad, readFileSync(voll));
  }
})(wurzel);

/** Antwort für einen Pfad: { status, headers, body }. */
export function antwort(rohPfad) {
  let pfad;
  try { pfad = decodeURIComponent(rohPfad); } catch { pfad = '/'; }
  if (!pfad.endsWith('/') && ordner.has(pfad + '/')) return { status: 301, headers: { Location: pfad + '/' }, body: Buffer.alloc(0) };
  const datei = pfad.endsWith('/') ? pfad + 'index.html' : pfad;
  const inhalt = dateien.get(datei);
  if (!inhalt) return { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('Nicht gefunden') };
  return { status: 200, headers: { 'Content-Type': typen[extname(datei).toLowerCase()] ?? 'application/octet-stream' }, body: inhalt };
}
export const anzahl = dateien.size;
