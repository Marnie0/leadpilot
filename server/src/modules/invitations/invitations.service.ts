import { randomBytes } from 'node:crypto';
import type { Prisma, UserRole } from '@prisma/client';
import {
  INVITE_LIFETIME_DAYS,
  type AcceptInvitationInput,
  type CreateInvitationInput,
  type InvitationDto,
  type InvitationPreviewDto,
  type InvitationState,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hashToken } from '../../lib/tokens.js';
import { isManager } from '../../lib/permissions.js';
import { logger } from '../../logger.js';
import { recordWorkspaceEvent } from '../../lib/workspace-events.js';
import { pickAvatarColor } from '../../lib/stage-presets.js';
import { sendEmail } from '../email/email.provider.js';
import { ROLE_NAMES, appLink, buildEmail } from '../email/email.templates.js';
import type { Actor } from '../leads/leads.service.js';

/**
 * Invitations.
 *
 * ## Who may invite whom
 *
 * Issuing an invitation is granting a role, just with a delay, so it is bounded
 * by the same rule: only the owner may create an ADMIN invitation. Leaving that
 * out would make "only the owner grants admin" a rule about which button you
 * press rather than about what you can do — an admin would simply send a link.
 *
 * ## What the link is
 *
 * A 32-byte secret that exists in exactly two places: the email, and the URL
 * the recipient clicks. Only its SHA-256 is stored, so the link cannot be
 * recovered from the database or shown again in the UI. Single-use, seven-day
 * expiry, revocable.
 */

const LIFETIME_MS = INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

const INVITATION_SELECT = {
  id: true,
  email: true,
  role: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
  invitedBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true } },
} satisfies Prisma.InvitationSelect;

type InvitationRow = Prisma.InvitationGetPayload<{ select: typeof INVITATION_SELECT }>;

/**
 * The state of an invitation, derived rather than stored.
 *
 * Storing it would mean a row that says PENDING three weeks after it expired,
 * because nothing runs at the moment of expiry to change it. Deriving it from
 * the timestamps cannot drift.
 */
function stateOf(
  row: Pick<InvitationRow, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
): InvitationState {
  if (row.acceptedAt) return 'ACCEPTED';
  if (row.revokedAt) return 'REVOKED';
  if (row.expiresAt.getTime() < Date.now()) return 'EXPIRED';
  return 'PENDING';
}

function toDto(row: InvitationRow, link?: string, emailed = false): InvitationDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role as Exclude<UserRole, 'OWNER'>,
    state: stateOf(row),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    invitedBy: row.invitedBy,
    acceptedBy: row.acceptedBy,
    emailed,
    ...(link ? { link } : {}),
  };
}

/** The role rule, in one place so the invite path and the role path agree. */
export function assertMayGrantRole(actor: Actor, role: UserRole): void {
  if (role === 'OWNER') {
    throw forbidden('Ownership is transferred, not granted', 'OWNER_TRANSFER_ONLY');
  }
  if (role === 'ADMIN' && actor.role !== 'OWNER') {
    throw forbidden('Only the workspace owner can make someone an admin', 'OWNER_GRANT_ONLY');
  }
}

export async function listInvitations(actor: Actor): Promise<InvitationDto[]> {
  if (!isManager(actor)) throw forbidden('Only an owner or admin can see invitations');
  const rows = await prisma.invitation.findMany({
    where: { organizationId: actor.organizationId },
    select: INVITATION_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((row) => toDto(row));
}

export async function createInvitation(
  actor: Actor,
  input: CreateInvitationInput,
): Promise<InvitationDto> {
  if (!isManager(actor)) throw forbidden('Only an owner or admin can invite people');
  assertMayGrantRole(actor, input.role);

  if (input.email) {
    // A member of this workspace already. Refused rather than silently
    // no-oped, because the person clicking expects somebody to be added.
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { organizationId: true },
    });
    if (existing?.organizationId === actor.organizationId) {
      throw conflict('That person is already in this workspace', 'ALREADY_A_MEMBER');
    }

    // Supersede an outstanding invitation to the same address rather than
    // stacking a second live link for one person.
    await prisma.invitation.updateMany({
      where: {
        organizationId: actor.organizationId,
        email: input.email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  const token = randomBytes(32).toString('base64url');

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.invitation.create({
      data: {
        organizationId: actor.organizationId,
        email: input.email ?? null,
        role: input.role,
        tokenHash: hashToken(token),
        invitedById: actor.userId,
        expiresAt: new Date(Date.now() + LIFETIME_MS),
      },
      select: INVITATION_SELECT,
    });

    await recordWorkspaceEvent(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      type: 'MEMBER_INVITED',
      metadata: { subject: input.email ?? 'link', role: input.role },
    });

    return created;
  });

  const link = appLink(`/invite/${token}`);
  let emailed = false;

  if (input.email) {
    const [inviter, organization] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true, locale: true } }),
      prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { name: true, defaultLocale: true },
      }),
    ]);
    const locale = organization?.defaultLocale ?? inviter?.locale ?? 'en';
    const message = buildEmail('invite', locale, link, {
      inviter: inviter?.name ?? 'A colleague',
      workspace: organization?.name ?? 'LeadPilot',
      role: ROLE_NAMES[locale]?.[input.role] ?? input.role,
    });
    const result = await sendEmail({ to: input.email, kind: 'invite', ...message });
    emailed = result.sent;
  }

  logger.info({ organizationId: actor.organizationId, role: input.role }, 'invitation created');
  // The only moment the raw link is ever available.
  return toDto(row, link, emailed);
}

export async function revokeInvitation(actor: Actor, id: string): Promise<InvitationDto> {
  if (!isManager(actor)) throw forbidden('Only an owner or admin can revoke invitations');

  const existing = await prisma.invitation.findFirst({
    where: { id, organizationId: actor.organizationId },
    select: INVITATION_SELECT,
  });
  if (!existing) throw notFound('Invitation');
  if (existing.acceptedAt) {
    throw badRequest('That invitation has already been accepted', 'INVITE_ALREADY_ACCEPTED');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: INVITATION_SELECT,
    });
    await recordWorkspaceEvent(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      type: 'INVITE_REVOKED',
      metadata: { subject: existing.email ?? 'link', role: existing.role },
    });
    return updated;
  });

  return toDto(row);
}

/**
 * Looks an invitation up by its raw token.
 *
 * Public — the token *is* the authorisation. It returns the workspace name and
 * the role so the accept screen can say what is being joined, which the holder
 * of the link is entitled to know and nobody else can ask for.
 */
export async function previewInvitation(token: string): Promise<InvitationPreviewDto> {
  const row = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      ...INVITATION_SELECT,
      organization: { select: { name: true } },
    },
  });

  if (!row || stateOf(row) !== 'PENDING') {
    throw notFound('Invitation');
  }

  return {
    workspaceName: row.organization.name,
    role: row.role as Exclude<UserRole, 'OWNER'>,
    invitedByName: row.invitedBy?.name ?? null,
    email: row.email,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export interface AcceptedInvitation {
  userId: string;
}

/**
 * Redeems an invitation, creating the account.
 *
 * The claim is a compare-and-swap on `acceptedAt`, inside the same transaction
 * that creates the user: two people opening the same link at once cannot both
 * end up with an account, and a failure anywhere in between leaves the
 * invitation unspent rather than burnt with nothing to show for it.
 */
export async function acceptInvitation(
  token: string,
  input: AcceptInvitationInput,
): Promise<AcceptedInvitation> {
  const { hashPassword } = await import('../../lib/password.js');

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      ...INVITATION_SELECT,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });
  if (!invitation || stateOf(invitation) !== 'PENDING') throw notFound('Invitation');

  // A bound invitation is redeemable only under the address it names, whatever
  // the form sent — otherwise forwarding it to somebody else silently works.
  const email = invitation.email ?? input.email;
  if (!email) {
    throw badRequest('An email address is required to accept this invitation', 'EMAIL_REQUIRED');
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw conflict('An account with that email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  const userId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw notFound('Invitation');

    const user = await tx.user.create({
      data: {
        organizationId: invitation.organizationId,
        email,
        passwordHash,
        name: input.name,
        role: invitation.role,
        avatarColor: pickAvatarColor(email),
        // Accepting an emailed invitation *is* proof of the address, when the
        // invitation named it. An open link proves nothing about who redeemed it.
        emailVerifiedAt: invitation.email ? new Date() : null,
      },
      select: { id: true },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedById: user.id },
      select: { id: true },
    });

    await recordWorkspaceEvent(tx, {
      organizationId: invitation.organizationId,
      userId: user.id,
      type: 'INVITE_ACCEPTED',
      metadata: { subject: input.name, role: invitation.role },
    });

    return user.id;
  });

  logger.info({ userId, organizationId: invitation.organizationId }, 'invitation accepted');
  return { userId };
}

/** Drops invitations long past their expiry. Runs from the daily job. */
export async function purgeExpiredInvitations(now = new Date()): Promise<number> {
  const { count } = await prisma.invitation.deleteMany({
    where: {
      acceptedAt: null,
      expiresAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    },
  });
  return count;
}
