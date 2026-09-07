import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` picks the 3-argument overload, which drops the tuning options we
// need, so the promisified signature is declared explicitly.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard (unlike bcrypt) and, being built into Node, carries no
 * native addon that could fail to load on a serverless host — which is exactly
 * the trade-off that rules out argon2 bindings here.
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet's scrypt option
 * `N=2^16, r=8, p=2`, costing roughly 64 MB of memory per verification.
 */
const SCRYPT_N = 2 ** 16;
const SCRYPT_R = 8;
const SCRYPT_P = 2;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** Node's default maxmem (32 MB) is below what these parameters need. */
const MAX_MEM = 192 * 1024 * 1024;

const PREFIX = 'scrypt';

/** Produces `scrypt$N$r$p$<salt-b64url>$<key-b64url>`. */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(plaintext.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  });

  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Constant-time verification. Returns `false` for malformed digests rather than
 * throwing, so a corrupted row cannot 500 the login route.
 */
export async function verifyPassword(plaintext: string, digest: string): Promise<boolean> {
  const parts = digest.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw ?? '', 'base64url');
    expected = Buffer.from(keyRaw ?? '', 'base64url');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = await scrypt(plaintext.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAX_MEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification so that "unknown email"
 * and "wrong password" are indistinguishable to a timing attacker enumerating
 * accounts against the login endpoint.
 */
let decoyDigest: string | undefined;
export async function simulatePasswordVerification(): Promise<void> {
  decoyDigest ??= await hashPassword(randomBytes(24).toString('base64url'));
  await verifyPassword('not-the-password', decoyDigest);
}
