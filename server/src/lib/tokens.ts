import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../env.js';

const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);

const ISSUER = 'leadpilot';
const ACCESS_AUDIENCE = 'leadpilot:access';
const REFRESH_AUDIENCE = 'leadpilot:refresh';

export const ACCESS_TOKEN_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const REFRESH_TOKEN_TTL_SECONDS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  /** Organisation id — every authorised query is scoped by this. */
  org: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;
  jti: string;
}

export async function signAccessToken(claims: {
  userId: string;
  organizationId: string;
  role: AccessTokenClaims['role'];
}): Promise<string> {
  return new SignJWT({ org: claims.organizationId, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, accessSecret, {
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
    algorithms: ['HS256'],
  });
  return payload as AccessTokenClaims;
}

export interface IssuedRefreshToken {
  token: string;
  /** Stored on the RefreshToken row so a specific session can be revoked. */
  jti: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * The refresh token is a signed JWT *and* a database row. The signature lets us
 * reject forged tokens without a query; the row is what makes a session
 * revocable, which a stateless JWT alone can never be.
 */
export async function issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const token = await new SignJWT({ nonce: randomBytes(12).toString('base64url') })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(refreshSecret);

  return { token, jti, tokenHash: hashToken(token), expiresAt };
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
    algorithms: ['HS256'],
  });
  if (typeof payload.jti !== 'string' || typeof payload.sub !== 'string') {
    throw new Error('Refresh token is missing required claims');
  }
  return payload as RefreshTokenClaims;
}

/**
 * Tokens are stored as SHA-256 digests. A dump of the sessions table therefore
 * hands an attacker nothing usable. Plain SHA-256 (not scrypt) is correct here:
 * the input is 200+ bits of signed random data, so there is nothing to brute-force.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
