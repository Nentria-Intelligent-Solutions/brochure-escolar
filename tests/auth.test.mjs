import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { hashPassword } from '../lib/password.mjs';
import { createApp, readConfig } from '../server.mjs';
let hash;
const password = 'Test-only-password!2026';
const origin = 'http://127.0.0.1:8093';
before(async () => { hash = await hashPassword(password); });
async function fixture(t, overrides = {}) {
  const server = createApp({ user: 'demo', hash, origin, secure: false, sessionMs: 3600000, ...overrides });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (pathname, options = {}) => fetch(base + pathname, { redirect: 'manual', ...options });
  const login = (pass = password, extra = {}) => request('/auth/login', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams({ username: 'demo', password: pass }) });
  return { request, login };
}
test('Protege la presentación y sus assets; el login y el logo son públicos', async t => {
  const { request } = await fixture(t);
  for (const pathname of ['/', '/index.html', '/app.js', '/styles.css', '/assets/comunidad.png']) {
    const response = await request(pathname); assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/login');
  }
  const login = await request('/login');assert.equal(login.status, 200);assert.match(await login.text(), /Tu acceso a Nenova/);
  assert.equal((await request('/login.css')).status, 200);
  assert.equal((await request('/assets/nenova-logo.png')).status, 200);
});
test('Login correcto, cookie protegida, rotación y logout invalidan la sesión', async t => {
  const { request, login } = await fixture(t);
  const denied = await login('incorrecta');assert.equal(denied.status, 401);assert.equal(denied.headers.get('set-cookie'), null);
  const ok = await login();assert.equal(ok.status, 303);
  const fullCookie = ok.headers.get('set-cookie');assert.match(fullCookie, /HttpOnly/);assert.match(fullCookie, /SameSite=Strict/);assert.doesNotMatch(fullCookie, /Secure/);
  const cookie = fullCookie.split(';')[0];
  const page = await request('/', { headers: { cookie } });assert.equal(page.status, 200);assert.equal(page.headers.get('cache-control'), 'no-store');assert.match(await page.text(), /Cerrar sesión/);
  const renewed = await login(password, { cookie });const newCookie = renewed.headers.get('set-cookie').split(';')[0];assert.notEqual(newCookie, cookie);
  assert.equal((await request('/', { headers: { cookie } })).status, 303);
  const logout = await request('/auth/logout', { method: 'POST', headers: { origin, cookie: newCookie } });assert.equal(logout.status, 303);assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/', { headers: { cookie: newCookie } })).status, 303);
});
test('No acepta cookies inventadas, orígenes externos ni archivos privados', async t => {
  const { request, login } = await fixture(t);
  assert.equal((await request('/', { headers: { cookie: 'nenova_session='+'0'.repeat(64) } })).status, 303);
  assert.equal((await login(password, { origin: 'https://intruso.example' })).status, 403);
  const noOrigin = await request('/auth/login', { method: 'POST', body: new URLSearchParams({ username: 'demo', password }) });assert.equal(noOrigin.status, 403);
  const ok = await login();const cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/auth/logout', { method: 'POST', headers: { origin: 'https://intruso.example', cookie } })).status, 403);
  assert.equal((await request('/', { headers: { cookie } })).status, 200);
  for (const pathname of ['/.env', '/.git/config', '/.openai/hosting.json', '/server.mjs', '/%2e%2e%2f.env']) assert.equal((await request(pathname, { headers: { cookie } })).status, 404);
});
test('Limita intentos y tamaño de la petición', async t => {
  const { request, login } = await fixture(t);
  const large = await request('/auth/login', { method: 'POST', headers: { origin, 'content-type':'application/x-www-form-urlencoded' }, body:'x='.padEnd(9000,'x') });assert.equal(large.status,413);
  for(let i=0;i<5;i++)assert.equal((await login('incorrecta')).status,401);
  const limited=await login();assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
});
test('Caducidad absoluta y cookies Secure en producción', async t => {
  const {request,login}=await fixture(t,{secure:true,sessionMs:100});
  const result=await login();const raw=result.headers.get('set-cookie');assert.match(raw,/^__Host-nenova_session=/);assert.match(raw,/; Secure/);
  await new Promise(resolve=>setTimeout(resolve,130));
  assert.equal((await request('/',{headers:{cookie:raw.split(';')[0]}})).status,303);
});
test('No inicia con configuración insegura de producción o sin credenciales',()=>{
  assert.throws(()=>readConfig({}),/setup/);
  assert.throws(()=>readConfig({LOGIN_USER:'demo',LOGIN_PASSWORD_HASH:hash,NODE_ENV:'production'}),/producción/);
  assert.equal(readConfig({LOGIN_USER:'demo',LOGIN_PASSWORD_HASH:hash,NODE_ENV:'production',COOKIE_SECURE:'true',PUBLIC_ORIGIN:'https://demo.example'}).secure,true);
});
