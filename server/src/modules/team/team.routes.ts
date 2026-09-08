import { Router } from 'express';
import { z } from 'zod';
import { idSchema, msg, requiredTrimmed, USER_ROLES } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { asyncHandler, getAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { assertMayGrantRole } from '../invitations/invitations.service.js';
import { recordWorkspaceEvent } from '../../lib/workspace-events.js';
import { confirmationMatches, transferOwnershipSchema } from '@leadpilot/shared';
import { param, validate } from '../../middleware/validate.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { TEAM_MEMBER_SELECT, toTeamMemberDto } from '../../lib/serializers.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]) => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
};

export const teamRouter = Router();
teamRouter.use(requireAuth);

/**
 * The member list feeds every assignee picker in the UI, so it is readable by
 * any member of the organisation — but only ever within their own organisation.
 */
teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { organizationId } = getAuth(req);
    const members = await prisma.user.findMany({
      where: { organizationId },
      select: { ...TEAM_MEMBER_SELECT, lastLoginAt: true, createdAt: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    res.json({
      members: members.map((member) => ({
        ...toTeamMemberDto(member),
        lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
      })),
    });
  }),
);

const updateMemberSchema = z
  .object({
    name: requiredTrimmed('field.name', 80, 2).optional(),
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });

teamRouter.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(z.object({ id: idSchema }), 'params'),
  validate(updateMemberSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const targetId = param(req, 'id');

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: auth.organizationId },
      select: { id: true, role: true, name: true },
    });
    if (!target) throw notFound('Team member');

    const body = req.body as z.infer<typeof updateMemberSchema>;

    /*
     * The owner is untouchable through this endpoint, in either direction.
     *
     * There is exactly one owner and the database enforces it, so "demote the
     * owner" has no valid destination — a workspace with no owner is not a
     * state the product has. Handing the role over is a different operation
     * with its own confirmation: see POST /team/:id/transfer-ownership.
     */
    if (target.role === 'OWNER') {
      throw forbidden('The owner can only be changed by transferring ownership', 'OWNER_ONLY');
    }
    /*
     * Only the owner may make somebody an admin.
     *
     * This is the rule an admin would otherwise route around: the guard used to
     * cover only the OWNER role, so an admin could promote a colleague — or
     * themselves — to admin freely. Granting a role you cannot grant directly
     * is also blocked on the invitation path, in `assertMayGrantRole`, because
     * a link is just a slower button.
     */
    if (body.role !== undefined) assertMayGrantRole(actorFrom(req), body.role);
    if (target.id === auth.userId && body.isActive === false) {
      throw badRequest('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    }
    if (target.id === auth.userId && body.role !== undefined && body.role !== target.role) {
      // An admin demoting themselves would be a one-way trip with no admin
      // left to undo it, and is far more likely a misclick than an intention.
      throw badRequest('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: target.id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.role !== undefined && { role: body.role }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: TEAM_MEMBER_SELECT,
      });

      // A role change is a permission change, so it belongs on the workspace
      // record alongside the currency conversion and the ownership transfer.
      if (body.role !== undefined && body.role !== target.role) {
        await recordWorkspaceEvent(tx, {
          organizationId: auth.organizationId,
          userId: auth.userId,
          type: 'MEMBER_ROLE_CHANGED',
          metadata: { subject: row.name, role: body.role, previousRole: target.role },
        });
      }

      return row;
    });

    // Deactivating a member must also end their live sessions, or their existing
    // access token keeps working until it expires.
    if (body.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json({ member: toTeamMemberDto(updated) });
  }),
);

/**
 * Handing the workspace to somebody else.
 *
 * ## Why this is not `PATCH /team/:id { role: 'OWNER' }`
 *
 * Because it is not a role change, it is two of them that must happen together:
 * the database allows exactly one owner per workspace, so promoting anybody
 * without demoting the incumbent in the same transaction is not a race to be
 * careful about — it is a constraint violation. Modelling it as one operation
 * makes that impossible to get wrong, and gives the action somewhere to put the
 * confirmation it deserves.
 *
 * `confirmName` is the same friction as a permanent delete. From the giver's
 * side this cannot be undone: afterwards only the new owner can hand it back.
 */
teamRouter.post(
  '/:id/transfer-ownership',
  requireRole('OWNER'),
  validate(z.object({ id: idSchema }), 'params'),
  validate(transferOwnershipSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const targetId = param(req, 'id');
    const { confirmName } = req.body as z.infer<typeof transferOwnershipSchema>;

    if (targetId === auth.userId) {
      throw badRequest('You already own this workspace', 'ALREADY_OWNER');
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: auth.organizationId, isActive: true },
      select: { id: true, name: true, role: true },
    });
    if (!target) throw notFound('Team member');

    if (!confirmationMatches(confirmName, target.name)) {
      throw badRequest('The name you typed does not match', 'CONFIRMATION_MISMATCH');
    }

    const member = await prisma.$transaction(async (tx) => {
      // Demote first: the partial unique index permits one OWNER per
      // organisation, so promoting before demoting would collide with itself.
      await tx.user.update({
        where: { id: auth.userId },
        data: { role: 'ADMIN' },
        select: { id: true },
      });
      const promoted = await tx.user.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
        select: TEAM_MEMBER_SELECT,
      });
      await recordWorkspaceEvent(tx, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: 'OWNERSHIP_TRANSFERRED',
        metadata: { subject: target.name, role: 'OWNER', previousRole: target.role },
      });
      return promoted;
    });

    res.json({ member: toTeamMemberDto(member) });
  }),
);

/**
 * Removing somebody from the workspace.
 *
 * Deactivation rather than deletion: a member's name is on leads, activities
 * and follow-ups all over the workspace, and deleting the row would either
 * cascade that history away or leave it attributed to nobody. Deactivating
 * ends every session immediately and takes the account out of every list,
 * while "assigned to Sara" keeps meaning something.
 */
teamRouter.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(z.object({ id: idSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const targetId = param(req, 'id');

    if (targetId === auth.userId) {
      throw badRequest('You cannot remove your own account', 'CANNOT_DEACTIVATE_SELF');
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: auth.organizationId },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!target) throw notFound('Team member');
    if (target.role === 'OWNER') {
      throw forbidden('The owner cannot be removed. Transfer ownership first.', 'OWNER_ONLY');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { isActive: false },
        select: { id: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await recordWorkspaceEvent(tx, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: 'MEMBER_REMOVED',
        metadata: { subject: target.name, role: target.role },
      });
    });

    res.status(204).end();
  }),
);
