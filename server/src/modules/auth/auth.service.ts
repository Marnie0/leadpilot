import type { Prisma, User } from '@prisma/client';
import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  SignupInput,
  UpdateProfileInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { hashPassword, simulatePasswordVerification, verifyPassword } from '../../lib/password.js';
import {
  hashToken,
  issueRefreshToken,
  signAccessToken,
  verifyRefreshToken,
} from '../../lib/tokens.js';
import { DEFAULT_STAGE_PRESETS, pickAvatarColor } from '../../lib/stage-presets.js';
import { logger } from '../../logger.js';
import { createDemoSandbox, reapExpiredSandboxes } from './demo.service.js';

export interface SessionContext {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const AUTH_USER_INCLUDE = {
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      defaultCurrency: true,
      isDemo: true,
      isDemoTemplate: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.UserInclude;

type AuthUserRow = Prisma.UserGetPayload<{ include: typeof AUTH_USER_INCLUDE }>;

/**
 * The currencies a workspace actually holds leads in.
 *
 * On the session because it decides whether the "converted or broken down"
 * control exists at all. A grouped scan over an organisation-scoped index, and
 * the answer is a handful of rows at most.
 */
async function workspaceCurrencies(organizationId: string): Promise<string[]> {
  const groups = await prisma.lead.groupBy({
    by: ['currency'],
    where: { organizationId, deletedAt: null },
    orderBy: { currency: 'asc' },
  });
  return groups.map((group) => group.currency);
}

async function toAuthUser(user: AuthUserRow): Promise<AuthUser> {
  const currencies = await workspaceCurrencies(user.organizationId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
    displayCurrency: user.displayCurrency,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
      defaultCurrency: user.organization.defaultCurrency,
      currencies,
      isDemo: user.organization.isDemo,
      expiresAt: user.organization.expiresAt?.toISOString() ?? null,
    },
  };
}

function slugify(value: string): string {
  const base = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return base.length >= 2 ? base : 'workspace';
}

/** Appends a short random suffix until the slug is free. */
async function uniqueSlug(candidate: string): Promise<string> {
  let slug = candidate;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${candidate}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

async function createSession(user: User, context: SessionContext) {
  const [accessToken, refresh] = await Promise.all([
    signAccessToken({ userId: user.id, organizationId: user.organizationId, role: user.role }),
    issueRefreshToken(user.id),
  ]);

  await prisma.refreshToken.create({
    data: {
      id: refresh.jti,
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      userAgent: context.userAgent?.slice(0, 255),
      ipAddress: context.ipAddress?.slice(0, 64),
    },
  });

  return { accessToken, refreshToken: refresh.token };
}

/**
 * Creates the organisation, its six pipeline stages and the owner account in a
 * single transaction — a half-built tenant (an org with no stages) would break
 * every lead query, so it must be all or nothing.
 */
export async function signup(input: SignupInput, context: SessionContext): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw conflict('An account with that email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(slugify(input.organizationName));

  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug,
        // The founder's language becomes the workspace's default, which is what
        // a member invited later will start in.
        ...(input.locale && { defaultLocale: input.locale }),
        stages: {
          create: DEFAULT_STAGE_PRESETS.map((preset) => ({
            key: preset.key,
            name: preset.name,
            nameAr: preset.nameAr,
            color: preset.color,
            order: preset.order,
            type: preset.type,
          })),
        },
      },
    });

    return tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        passwordHash,
        name: input.name,
        role: 'OWNER',
        ...(input.locale && { locale: input.locale }),
        avatarColor: pickAvatarColor(input.email),
        lastLoginAt: new Date(),
      },
      include: AUTH_USER_INCLUDE,
    });
  });

  const tokens = await createSession(user, context);
  logger.info({ userId: user.id, organizationId: user.organizationId }, 'organisation created');

  return { user: await toAuthUser(user), ...tokens };
}

export async function login(input: LoginInput, context: SessionContext): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: AUTH_USER_INCLUDE,
  });

  // Same error and roughly the same timing whether the email is unknown, the
  // password is wrong, or the account is disabled — nothing here should let an
  // attacker enumerate which emails have accounts.
  if (!user || !user.isActive) {
    await simulatePasswordVerification();
    throw unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  // The template is cloned, never entered. Signing into it directly would let a
  // visitor edit the master copy every future sandbox is made from.
  if (user.organization.isDemoTemplate) {
    throw forbidden(
      'That account belongs to the demo template. Use "Start demo" to open your own sandbox.',
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: { id: true },
  });

  const tokens = await createSession(user, context);
  return { user: await toAuthUser(user), ...tokens };
}

/**
 * Rotates the refresh token: the presented token is revoked and a fresh pair is
 * issued. Presenting an *already revoked* token means the cookie leaked and is
 * being replayed, so every session for that user is killed.
 */
export async function refreshSession(
  rawToken: string,
  context: SessionContext,
): Promise<AuthResult> {
  let claims: Awaited<ReturnType<typeof verifyRefreshToken>>;
  try {
    claims = await verifyRefreshToken(rawToken);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });

  if (!stored || stored.userId !== claims.sub) {
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  if (stored.revokedAt) {
    logger.warn({ userId: stored.userId }, 'refresh token reuse detected — revoking all sessions');
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: AUTH_USER_INCLUDE,
  });
  if (!user || !user.isActive) {
    throw unauthorized('Your account is no longer active', 'ACCOUNT_INACTIVE');
  }

  const [accessToken, next] = await Promise.all([
    signAccessToken({ userId: user.id, organizationId: user.organizationId, role: user.role }),
    issueRefreshToken(user.id),
  ]);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        id: next.jti,
        userId: user.id,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
        userAgent: context.userAgent?.slice(0, 255),
        ipAddress: context.ipAddress?.slice(0, 64),
      },
    }),
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: next.jti },
    }),
  ]);

  return { user: await toAuthUser(user), accessToken, refreshToken: next.token };
}

/** Revokes the presented session. Never throws — logging out always succeeds. */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  try {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    logger.warn({ err: error }, 'failed to revoke refresh token on logout');
  }
}

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: AUTH_USER_INCLUDE });
  if (!user || !user.isActive) throw unauthorized();
  return await toAuthUser(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.locale !== undefined && { locale: input.locale }),
      // `null` is a real value here — it clears the override and puts the user
      // back on the workspace currency — so this tests for `undefined`, not
      // truthiness. See `updateProfileSchema`.
      ...(input.displayCurrency !== undefined && { displayCurrency: input.displayCurrency }),
    },
    include: AUTH_USER_INCLUDE,
  });
  return await toAuthUser(user);
}

/**
 * Changing a password revokes every other session, which is the whole point of
 * the control — a stolen cookie stops working the moment the owner reacts.
 */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw unauthorized();

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid)
    throw unauthorized('Your current password is incorrect', 'CURRENT_PASSWORD_INCORRECT');

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/**
 * Opens a private demo sandbox and signs the visitor into it.
 *
 * Each visitor gets a full clone of the template workspace, so anything they
 * change is invisible to everyone else and the next visitor still starts from a
 * pristine copy.
 */
export async function startDemoSession(context: SessionContext): Promise<AuthResult> {
  // Opportunistic cleanup: keeps sandboxes from piling up between cron runs.
  await reapExpiredSandboxes().catch((error) => {
    logger.warn({ err: error }, 'sandbox reap failed; continuing');
  });

  const sandbox = await createDemoSandbox();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sandbox.ownerUserId },
    include: AUTH_USER_INCLUDE,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: { id: true },
  });

  const tokens = await createSession(user, context);
  return { user: await toAuthUser(user), ...tokens };
}
