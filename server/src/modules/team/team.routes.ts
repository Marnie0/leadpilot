import { Router } from 'express';
import { z } from 'zod';
import { idSchema, msg, requiredTrimmed, USER_ROLES } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { asyncHandler, getAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { param, validate } from '../../middleware/validate.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { TEAM_MEMBER_SELECT, toTeamMemberDto } from '../../lib/serializers.js';

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
      select: { id: true, role: true },
    });
    if (!target) throw notFound('Team member');

    const body = req.body as z.infer<typeof updateMemberSchema>;

    // The owner is the account of last resort: only an owner may change an
    // owner, and nobody may lock themselves out of their own workspace.
    if (target.role === 'OWNER' && auth.role !== 'OWNER') {
      throw forbidden('Only the workspace owner can change the owner account', 'OWNER_ONLY');
    }
    if (target.id === auth.userId && body.isActive === false) {
      throw badRequest('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    }
    if (target.role === 'OWNER' && body.role !== undefined && body.role !== 'OWNER') {
      const otherOwners = await prisma.user.count({
        where: { organizationId: auth.organizationId, role: 'OWNER', id: { not: target.id } },
      });
      if (otherOwners === 0) {
        throw badRequest('A workspace must always have an owner', 'LAST_OWNER');
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      select: TEAM_MEMBER_SELECT,
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
