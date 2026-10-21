import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };

export function readConfig(env = process.env) {
  const port = Number(env.PORT || 8093);
  const host = env.HOST || '127.0.0.1';
  const production = env.NODE_ENV === 'production';
  const secure = production;
  const origin = new URL(env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`);
  if (!['http:', 'https:'].includes(origin.protocol)) throw Error('PUBLIC_ORIGIN debe usar http o https.');
  return { port, host, secure, origin: origin.origin };
}

export function createApp(config) {
  async function file(req, res, filename) {
    try {
      const info = await stat(filename);
      if (!info.isFile()) { send(res, 404, 'No encontrado.'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': info.size });
      res.end(req.method === 'HEAD' ? undefined : await readFile(filename));
    } catch (error) {
      if (!res.headersSent) send(res, error.code === 'ENOENT' ? 404 : 500, 'No se pudo cargar el recurso.');
      else res.destroy();
    }
  }
  function send(res, status, text, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type }); res.end(text);
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
    if (config.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(res, 405, 'Método no permitido.'); }
      const pathname = decodeURIComponent(new URL(req.url, config.origin).pathname);
      if (pathname === '/healthz') return send(res, 200, req.method === 'HEAD' ? '' : 'ok');
      if (pathname.includes('\\') || pathname.split('/').some(s => s.startsWith('.')) || pathname.includes('\0')) return send(res, 404, 'No encontrado.');
      const dist = await realpath(path.join(root, 'dist'));
      let filename;
      try { filename = await realpath(path.join(dist, pathname === '/' ? 'index.html' : pathname)); }
      catch { return send(res, 404, 'No encontrado.'); }
      if (!filename.startsWith(dist + path.sep)) return send(res, 404, 'No encontrado.');
      return file(req, res, filename);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) send(res, error.status || (error instanceof URIError ? 400 : 500), 'No se pudo procesar la solicitud.');
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

const isMain = !process.argv[1] || import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
    const config = readConfig();
    const server = createApp(config);
    server.on('error', error => { console.error(`No se pudo iniciar: ${error.code || 'error'}.`); process.exitCode = 1; server.close(); });
    server.listen(config.port, config.host, () => console.log(`Nenova listo en ${config.origin}`));
    const close = () => { server.close(); server.closeAllConnections(); };
    process.on('SIGTERM', close); process.on('SIGINT', close);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
