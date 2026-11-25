// Lokaler, isolierter Server für den Vision-Engine-Prototyp. Keine Abhängigkeiten, nur 127.0.0.1.
// Start: node prototypes/vision-engine/server.mjs   (Port über VISION_PORT, Standard 5197)
import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('./', import.meta.url))); // ohne abschließenden Trenner
const fonts = resolve(root, '../../public/fonts');
// dieselbe Engine wie in der App (eine Quelle, kein Doppel)
const engine = resolve(root, '../../app/spielbereich/modules/vision-engine');
const port = Number(process.env.VISION_PORT || 5197);
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

function inside(base, rel) {
  const p = resolve(base, '.' + sep + normalize(rel).replace(/^([/\\])+/, ''));
  return p === base || p.startsWith(base + sep) ? p : null;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let path = decodeURIComponent(url.pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let file;
    if (path === '/' || path === '/index.html') file = join(root, 'index.html');
    else if (path.startsWith('/fonts/')) file = inside(fonts, path.slice('/fonts/'.length));
    else if (path.startsWith('/engine/')) file = inside(engine, path.slice('/engine/'.length));
    else file = inside(root, path);
    const ext = extname(file || '').toLowerCase();
    if (!file || !types[ext] || /server\.mjs$|\.ps1$/i.test(file)) { res.writeHead(404); return res.end('Nicht gefunden'); }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); return res.end('Nicht gefunden'); }
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': types[ext], 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404); res.end('Nicht gefunden');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Vision Engine (Prototyp): http://127.0.0.1:${port}/`);
  console.log(`Spieleransicht:           http://127.0.0.1:${port}/?play`);
});
