import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { validHash, verifyPassword } from './lib/password.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicFiles = new Map([
  ['/login.css', path.join(root, 'auth/login.css')],
  ['/assets/nenova-logo.png', path.join(root, 'dist/assets/nenova-logo.png')],
  ['/favicon.svg', path.join(root, 'dist/favicon.svg')],
]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
const fingerprint = token => createHash('sha256').update(token).digest('hex');
export function readConfig(env = process.env) {
  const port = Number(env.PORT || 8093);
  const host = env.HOST || '127.0.0.1';
  const production = env.NODE_ENV === 'production';
  const secure = env.COOKIE_SECURE === 'true';
  const hours = Number(env.SESSION_HOURS || 8);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT debe ser un puerto válido.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw Error('SESSION_HOURS debe estar entre 0 y 24.');
  if (!env.LOGIN_USER || !validHash(env.LOGIN_PASSWORD_HASH)) throw Error('Falta el acceso local. Ejecuta npm run setup.');
  const origin = new URL(env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('PUBLIC_ORIGIN debe ser el origen público, sin rutas.');
  if (production && (!secure || origin.protocol !== 'https:')) throw Error('En producción usa PUBLIC_ORIGIN=https://tu-dominio y COOKIE_SECURE=true.');
  return { port, host, secure, origin: origin.origin, user: env.LOGIN_USER, hash: env.LOGIN_PASSWORD_HASH, sessionMs: hours * 3600000 };
}
export function createApp(config) {
  const sessions = new Map();
  const attempts = new Map();
  const cookieName = config.secure ? '__Host-nenova_session' : 'nenova_session';
  let passwordJobs = 0;
  const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
  const getToken = req => (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  function authenticated(req) {
    const token = getToken(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return false;
    const key = fingerprint(token);
    const expires = sessions.get(key);
    if (!expires || expires <= Date.now()) { sessions.delete(key); return false; }
    return true;
  }
  const timer = setInterval(() => {
    for (const [key, expires] of sessions) if (expires <= Date.now()) sessions.delete(key);
    for (const [key, record] of attempts) if (record.until <= Date.now()) attempts.delete(key);
  }, 60000).unref();
  function send(res, status, text, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type }); res.end(text);
  }
  function redirect(res, destination) { res.writeHead(303, { Location: destination }); res.end(); }
  async function loginPage(res, message = '', status = 200, head = false) {
    const template = await readFile(path.join(root, 'auth/login.html'), 'utf8');
    send(res, status, head ? '' : template.replace('<!--ERROR-->', message ? `<p class="error" role="alert">${message}</p>` : ''), 'text/html; charset=utf-8');
  }
  async function form(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') throw Object.assign(Error(), { status: 415 });
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) throw Object.assign(Error(), { status: 413 });
      chunks.push(chunk);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString());
  }
  async function file(req, res, filename) {
    try {
      const info = await stat(filename);
      if (!info.isFile()) return send(res, 404, 'No encontrado.');
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': info.size });
      res.end(req.method === 'HEAD' ? undefined : await readFile(filename));
    } catch (error) {
      if (!res.headersSent) send(res, error.code === 'ENOENT' ? 404 : 500, 'No se pudo cargar el recurso.');
      else res.destroy();
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (config.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const pathname = decodeURIComponent(new URL(req.url, config.origin).pathname);
      if (req.method === 'POST') {
        // A fixed origin avoids trusting client-controlled Host or forwarded headers.
        if (req.headers.origin !== config.origin || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, 'Solicitud no permitida. Recarga la página e inténtalo de nuevo.');
        if (pathname === '/auth/logout') {
          sessions.delete(fingerprint(getToken(req)));
          res.setHeader('Set-Cookie', cookie('', 0));
          return redirect(res, '/login');
        }
        if (pathname !== '/auth/login') return send(res, 404, 'No encontrado.');
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        let record = attempts.get(ip);
        if (!record || record.until <= now) {
          if (attempts.size >= 10000) return send(res, 429, 'Inténtalo de nuevo más tarde.');
          record = { count: 0, until: now + 15 * 60000 }; attempts.set(ip, record);
        }
        if (record.count >= 5 || passwordJobs >= 2) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.until - now) / 1000))));
          return loginPage(res, 'Demasiados intentos. Espera unos minutos antes de volver a intentar.', 429);
        }
        const data = await form(req);
        const username = data.get('username') || '';
        const password = data.get('password') || '';
        if (passwordJobs >= 2) return send(res, 429, 'Inténtalo de nuevo en unos segundos.');
        record.count++;
        if (username.length > 64 || !password || password.length > 256) return loginPage(res, 'Usuario o contraseña incorrectos.', 401);
        passwordJobs++;
        let matches;
        try { matches = await verifyPassword(password, config.hash); } finally { passwordJobs--; }
        if (!matches || username !== config.user) return loginPage(res, 'Usuario o contraseña incorrectos.', 401);
        attempts.delete(ip);
        sessions.delete(fingerprint(getToken(req)));
        if (sessions.size >= 10000) return send(res, 503, 'Inténtalo de nuevo más tarde.');
        const token = randomBytes(32).toString('hex');
        sessions.set(fingerprint(token), Date.now() + config.sessionMs);
        res.setHeader('Set-Cookie', cookie(token, Math.floor(config.sessionMs / 1000)));
        return redirect(res, '/');
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD, POST'); return send(res, 405, 'Método no permitido.'); }
      if (pathname === '/healthz') return send(res, 200, req.method === 'HEAD' ? '' : 'ok');
      if (pathname === '/login') return authenticated(req) ? redirect(res, '/') : loginPage(res, '', 200, req.method === 'HEAD');
      if (publicFiles.has(pathname)) return file(req, res, publicFiles.get(pathname));
      if (!authenticated(req)) return redirect(res, '/login');
      if (pathname === '/auth/session') return send(res, 200, '{"authenticated":true}', 'application/json');
      if (pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.')) || pathname.includes('\0')) return send(res, 404, 'No encontrado.');
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
  server.on('close', () => clearInterval(timer));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
    const config = readConfig();
    const server = createApp(config);
    server.on('error', error => { console.error(`No se pudo iniciar el servidor: ${error.code || 'error'}.`); process.exitCode = 1; server.close(); });
    server.listen(config.port, config.host, () => console.log(`Nenova listo en ${config.origin}\nAcceso propio; sin servicios externos de autenticación.`));
    const close = () => { server.close(); server.closeAllConnections(); };
    process.on('SIGTERM', close); process.on('SIGINT', close);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
