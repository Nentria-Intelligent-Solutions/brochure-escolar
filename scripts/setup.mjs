import { existsSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/password.mjs';
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const args = process.argv.slice(2);
const reset = args.includes('--reset');
const userIndex = args.indexOf('--user');
const user = userIndex >= 0 ? args[userIndex + 1] : 'demo';
if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(user || '')) {
  console.error('Usuario inválido: usa entre 3 y 64 letras, números, puntos, guiones o guiones bajos.');
  process.exit(1);
}
if (existsSync(envPath) && !reset) {
  console.error('Ya existe .env. Para generar una contraseña nueva usa npm run setup -- --user TU_USUARIO --reset.');
  process.exit(1);
}
if (existsSync(envPath)) process.loadEnvFile(envPath);
const password = randomBytes(15).toString('base64url');
const hash = await hashPassword(password);
const values = {
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || '8093',
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:8093',
  NODE_ENV: process.env.NODE_ENV || 'development',
  COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
  SESSION_HOURS: process.env.SESSION_HOURS || '8',
  LOGIN_USER: user,
  LOGIN_PASSWORD_HASH: hash,
};
const temporary = envPath + '.' + randomBytes(6).toString('hex') + '.tmp';
try {
  writeFileSync(temporary, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  renameSync(temporary, envPath);
} finally {
  if (existsSync(temporary)) unlinkSync(temporary);
}
console.log(`Acceso configurado. Guarda esta contraseña; no se conserva en texto plano.\nUsuario: ${user}\nContraseña: ${password}\nInicia con npm start. Si ya está corriendo, reinícialo para aplicar el cambio.`);
