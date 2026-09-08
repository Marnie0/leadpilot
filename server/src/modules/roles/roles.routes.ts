import { Router } from 'express';
import { z } from 'zod';
import { createRoleSchema, deleteRoleSchema, idSchema, updateRoleSchema } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as service from './roles.service.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    permissions: auth.permissions,
    isOwner: auth.isOwner,
  };
};

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

/*
 * Reading is open to the workspace; every write is owner-only, enforced in the
 * service rather than by middleware so the rule sits next to what it protects.
 */
rolesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ roles: await service.listRoles(actorFrom(req)) });
  }),
);

rolesRouter.post(
  '/',
  validate(createRoleSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ role: await service.createRole(actorFrom(req), req.body) });
  }),
);

rolesRouter.patch(
  '/:id',
  validate(z.object({ id: idSchema }), 'params'),
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    res.json({ role: await service.updateRole(actorFrom(req), param(req, 'id'), req.body) });
  }),
);

rolesRouter.delete(
  '/:id',
  validate(z.object({ id: idSchema }), 'params'),
  validate(deleteRoleSchema),
  asyncHandler(async (req, res) => {
    await service.deleteRole(actorFrom(req), param(req, 'id'), req.body.reassignToRoleId);
    res.status(204).end();
  }),
);
