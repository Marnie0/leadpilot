import { Router } from 'express';
import { z } from 'zod';
import { idSchema, msg, requiredTrimmed, type Permission } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import {
  asyncHandler,
  getAuth,
  requireAuth,
  requireOwner,
  requirePermission,
} from '../../middleware/auth.js';
import { assertMayGrantRole } from '../invitations/invitations.service.js';
import { canGrantRole } from '../../lib/permissions.js';
import { recordWorkspaceEvent } from '../../lib/workspace-events.js';
import { confirmationMatches, transferOwnershipSchema } from '@leadpilot/shared';
import { param, validate } from '../../middleware/validate.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { TEAM_MEMBER_SELECT, toTeamMemberDto } from '../../lib/serializers.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]) => {
  const auth = getAuth(req);
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    permissions: auth.permissions,
    isOwner: auth.isOwner,
  };
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
    /** A role row in this workspace, not a fixed tier. */
    roleId: idSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });

teamRouter.patch(
  '/:id',
  requirePermission('MANAGE_TEAM'),
  validate(z.object({ id: idSchema }), 'params'),
  validate(updateMemberSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const targetId = param(req, 'id');

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: auth.organizationId },
      select: {
        id: true,
        name: true,
        isOwner: true,
        isActive: true,
        role: { select: { id: true, name: true, permissions: true } },
      },
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
    if (target.isOwner) {
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
    const nextRole =
      body.roleId !== undefined ? await assertMayGrantRole(actorFrom(req), body.roleId) : null;
    /*
     * Reactivating somebody restores whatever role they already hold, which is
     * a grant in everything but name. Without this an admin who cannot assign
     * a role carrying, say, the currency permission could still bring back a
     * deactivated account that holds it — and act through it.
     */
    if (body.isActive === true && !target.isActive) {
      const restored = nextRole ?? target.role;
      if (!canGrantRole(actorFrom(req), { permissions: restored.permissions as Permission[] })) {
        throw forbidden(
          'You cannot reactivate an account whose role carries permissions you do not have yourself',
          'CANNOT_GRANT_ROLE',
        );
      }
    }
    if (target.id === auth.userId && body.isActive === false) {
      throw badRequest('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    }
    if (target.id === auth.userId && nextRole !== null && nextRole.id !== target.role.id) {
      // An admin demoting themselves would be a one-way trip with no admin
      // left to undo it, and is far more likely a misclick than an intention.
      throw badRequest('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
    }

    const updated = await prisma.$transaction(async (tx) => {
      /*
       * Every write to a member through this endpoint is conditional on the
       * member still not being the owner. The check above ran before this
       * transaction, and an ownership transfer can commit in between — after
       * which "deactivate" would deactivate the owner, and "change role" would
       * hand the owner an admin role, leaving the workspace with no active
       * owner. Zero rows means the row moved from under us; the client is told
       * to look again.
       */
      const { count } = await tx.user.updateMany({
        where: { id: target.id, organizationId: auth.organizationId, isOwner: false },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(nextRole !== null && { roleId: nextRole.id }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
      });
      if (count === 0) {
        throw conflict(
          'This member became the workspace owner just now. Reload and try again',
          'OWNER_ONLY',
        );
      }
      const row = await tx.user.findUniqueOrThrow({
        where: { id: target.id },
        select: TEAM_MEMBER_SELECT,
      });

      // A role change is a permission change, so it belongs on the workspace
      // record alongside the currency conversion and the ownership transfer.
      if (nextRole !== null && nextRole.id !== target.role.id) {
        await recordWorkspaceEvent(tx, {
          organizationId: auth.organizationId,
          userId: auth.userId,
          type: 'MEMBER_ROLE_CHANGED',
          metadata: { subject: row.name, role: nextRole.name, previousRole: target.role.name },
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
  requireOwner,
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
      select: { id: true, name: true, role: { select: { id: true, name: true } } },
    });
    if (!target) throw notFound('Team member');

    if (!confirmationMatches(confirmName, target.name)) {
      throw badRequest('The name you typed does not match', 'CONFIRMATION_MISMATCH');
    }

    const member = await prisma.$transaction(async (tx) => {
      const [ownerRole, adminRole] = await Promise.all([
        tx.role.findFirstOrThrow({
          where: { organizationId: auth.organizationId, key: 'OWNER' },
          select: { id: true },
        }),
        tx.role.findFirstOrThrow({
          where: { organizationId: auth.organizationId, key: 'ADMIN' },
          select: { id: true },
        }),
      ]);

      /*
       * Demote first: the partial unique index permits one owner per
       * organisation, so promoting before demoting would collide with itself.
       *
       * Both writes are conditional. The demotion requires the caller to still
       * be the owner, so two transfers racing each other end as one success and
       * one 409 rather than relying on the index to trip. The promotion
       * requires the target to still be an active member of this workspace:
       * if they deleted their account or were deactivated between the check
       * above and this write, zero rows come back, the whole transaction —
       * demotion included — rolls back, and the caller stays the owner. Without
       * this the workspace could end up owned by nobody, or by a deactivated
       * account that can never sign in again.
       */
      const demoted = await tx.user.updateMany({
        where: { id: auth.userId, organizationId: auth.organizationId, isOwner: true },
        data: { isOwner: false, roleId: adminRole.id },
      });
      if (demoted.count === 0) {
        throw conflict('Ownership of this workspace has already changed hands', 'NOT_OWNER');
      }
      const promotedCount = await tx.user.updateMany({
        where: { id: target.id, organizationId: auth.organizationId, isActive: true },
        data: { isOwner: true, roleId: ownerRole.id },
      });
      if (promotedCount.count === 0) {
        throw conflict(
          'That member is no longer active in this workspace, so ownership was not transferred',
          'TARGET_UNAVAILABLE',
        );
      }
      const promoted = await tx.user.findUniqueOrThrow({
        where: { id: target.id },
        select: TEAM_MEMBER_SELECT,
      });
      await recordWorkspaceEvent(tx, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: 'OWNERSHIP_TRANSFERRED',
        metadata: { subject: target.name, role: 'Owner', previousRole: target.role.name },
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
  requirePermission('MANAGE_TEAM'),
  validate(z.object({ id: idSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const targetId = param(req, 'id');

    if (targetId === auth.userId) {
      throw badRequest('You cannot remove your own account', 'CANNOT_DEACTIVATE_SELF');
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: auth.organizationId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isOwner: true,
        role: { select: { name: true } },
      },
    });
    if (!target) throw notFound('Team member');
    if (target.isOwner) {
      throw forbidden('The owner cannot be removed. Transfer ownership first.', 'OWNER_ONLY');
    }

    await prisma.$transaction(async (tx) => {
      // Conditional for the same reason as the PATCH above: an ownership
      // transfer landing between the check and this write would otherwise
      // deactivate the new owner, and nobody could ever sign in as the owner
      // again.
      const { count } = await tx.user.updateMany({
        where: { id: target.id, organizationId: auth.organizationId, isOwner: false },
        data: { isActive: false },
      });
      if (count === 0) {
        throw conflict(
          'This member became the workspace owner just now. Reload and try again',
          'OWNER_ONLY',
        );
      }
      await tx.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await recordWorkspaceEvent(tx, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: 'MEMBER_REMOVED',
        metadata: { subject: target.name, role: target.role.name },
      });
    });

    res.status(204).end();
  }),
);
