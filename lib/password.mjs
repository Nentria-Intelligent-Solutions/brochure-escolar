import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
export function validHash(value) {
  return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value || '');
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (!validHash(stored)) return false;
  const [, salt, expected] = stored.split('$');
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
