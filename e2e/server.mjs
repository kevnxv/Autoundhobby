// Statischer Server zum Ansehen im Browser, ausgeliefert wie GitHub Pages. Aufruf: npm run server
// Die Tests brauchen ihn nicht: Sie beantworten jede Anfrage direkt im Browser (e2e/umgebung.mjs), weil auf Kevins
// Rechner Antworten über das lokale Netz hängen blieben, sobald mehrere Browser gleichzeitig luden (2026-10-29).
import { createServer } from 'node:http';
import { antwort, anzahl } from './dateien.mjs';

const port = Number(process.argv[2] ?? 4340);
createServer((req, res) => {
  const { status, headers, body } = antwort(new URL(req.url, 'http://x').pathname);
  // no-store: Der Browser soll beim Ansehen immer den aktuellen Stand zeigen, nie eine alte Kopie.
  res.writeHead(status, { ...headers, 'Content-Length': body.length, 'Cache-Control': 'no-store' }).end(body);
}).listen(port, '127.0.0.1', () => console.log(`Bereit: http://127.0.0.1:${port}/ (${anzahl} Dateien)`));
