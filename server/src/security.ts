import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, keyHex] = encoded.split('$');
  if (algorithm !== 'scrypt-v1' || !salt || !keyHex || !/^[a-f0-9]{128}$/.test(keyHex)) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(keyHex, 'hex'));
}

export function newSessionToken(): string { return randomBytes(32).toString('base64url'); }
export function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function secretMatches(actual: string, expected: string): boolean {
  // Hash first so timingSafeEqual always compares equal-length buffers.
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
