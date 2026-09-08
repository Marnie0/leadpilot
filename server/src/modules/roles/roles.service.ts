import type { Prisma } from '@prisma/client';
import {
  type CreateRoleInput,
  type Permission,
  type RoleDto,
  type UpdateRoleInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { recordWorkspaceEvent } from '../../lib/workspace-events.js';
import { logger } from '../../logger.js';
import type { Actor } from '../leads/leads.service.js';

/**
 * The workspace's roles.
 *
 * Owner-only throughout. Managing roles is deliberately not itself a
 * permission: anyone who could edit roles could add every other permission to
 * their own, so a "manage roles" permission would be a way to grant yourself
 * the rest. Keeping it outside the system is what makes the rest meaningful.
 */

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  nameAr: true,
  permissions: true,
  isSystem: true,
  order: true,
  /*
   * Invitations are counted as well as accounts.
   *
   * `Invitation.role` is a required relation with no cascade, so *any* row
   * pointing at a role — including one accepted months ago — blocks the delete
   * at the database. Counting only members made the dialog offer no
   * reassignment picker for a role the server then refused to delete, which is
   * exactly the failure this count exists to prevent.
   */
  _count: { select: { users: true, invitations: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof ROLE_SELECT }>;

const toDto = (row: RoleRow): RoleDto => ({
  id: row.id,
  key: row.key,
  name: row.name,
  nameAr: row.nameAr,
  permissions: row.permissions as Permission[],
  isSystem: row.isSystem,
  memberCount: row._count.users,
  referenceCount: row._count.users + row._count.invitations,
  order: row.order,
});

function assertOwner(actor: Actor): void {
  if (!actor.isOwner) {
    throw forbidden('Only the workspace owner can manage roles', 'OWNER_ONLY');
  }
}

/**
 * Readable by anybody in the workspace.
 *
 * The team screen has to render "Sales rep" next to a colleague's name, and an
 * assignee picker needs the labels — neither of which is privileged
 * information. Only *changing* a role is restricted.
 */
export async function listRoles(actor: Actor): Promise<RoleDto[]> {
  const rows = await prisma.role.findMany({
    where: { organizationId: actor.organizationId },
    select: ROLE_SELECT,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toDto);
}

export async function createRole(actor: Actor, input: CreateRoleInput): Promise<RoleDto> {
  assertOwner(actor);

  const duplicate = await prisma.role.findFirst({
    where: {
      organizationId: actor.organizationId,
      name: { equals: input.name, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (duplicate) throw conflict('A role with that name already exists', 'ROLE_NAME_TAKEN');

  const last = await prisma.role.aggregate({
    where: { organizationId: actor.organizationId },
    _max: { order: true },
  });

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        organizationId: actor.organizationId,
        // Custom roles have no key: nothing in the product needs to find them
        // by name, and a key would imply a meaning the code does not act on.
        key: null,
        name: input.name,
        // Falls back to the English label rather than leaving it blank, so an
        // Arabic reader sees a role name rather than nothing at all.
        nameAr: input.nameAr?.trim() || input.name,
        permissions: input.permissions,
        isSystem: false,
        order: (last._max.order ?? 0) + 1,
      },
      select: ROLE_SELECT,
    });
    await recordWorkspaceEvent(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      type: 'ROLE_CREATED',
      metadata: { subject: created.name },
    });
    return created;
  });

  logger.info({ organizationId: actor.organizationId, roleId: row.id }, 'role created');
  return toDto(row);
}

export async function updateRole(
  actor: Actor,
  roleId: string,
  input: UpdateRoleInput,
): Promise<RoleDto> {
  assertOwner(actor);

  const existing = await prisma.role.findFirst({
    where: { id: roleId, organizationId: actor.organizationId },
    select: { id: true, key: true, name: true, isSystem: true },
  });
  if (!existing) throw notFound('Role');

  /*
   * The owner role's permissions are fixed at "everything".
   *
   * It can still be renamed — a workspace may call it "Founder" — but a
   * workspace whose owner had removed their own ability to manage the team
   * would be one nobody could administer, and there is no second owner to
   * repair it.
   */
  if (existing.key === 'OWNER' && input.permissions !== undefined) {
    throw badRequest('The owner role always has every permission', 'OWNER_ROLE_FIXED');
  }

  if (input.name !== undefined) {
    const duplicate = await prisma.role.findFirst({
      where: {
        organizationId: actor.organizationId,
        name: { equals: input.name, mode: 'insensitive' },
        id: { not: roleId },
      },
      select: { id: true },
    });
    if (duplicate) throw conflict('A role with that name already exists', 'ROLE_NAME_TAKEN');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.role.update({
      where: { id: roleId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.nameAr !== undefined && {
          nameAr: input.nameAr.trim() || input.name || existing.name,
        }),
        ...(input.permissions !== undefined && { permissions: input.permissions }),
      },
      select: ROLE_SELECT,
    });
    if (input.permissions !== undefined) {
      await recordWorkspaceEvent(tx, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        type: 'ROLE_UPDATED',
        metadata: { subject: updated.name },
      });
    }
    return updated;
  });

  return toDto(row);
}

/**
 * Deleting a role.
 *
 * The seeded three stay: something has to be assignable, and the owner role has
 * to exist. Anything else may go, but not while people hold it — every account
 * needs a role, so the caller names where its holders move to rather than the
 * product picking on their behalf and silently changing what somebody can do.
 */
export async function deleteRole(
  actor: Actor,
  roleId: string,
  reassignToRoleId: string | undefined,
): Promise<void> {
  assertOwner(actor);

  const existing = await prisma.role.findFirst({
    where: { id: roleId, organizationId: actor.organizationId },
    select: {
      id: true,
      name: true,
      isSystem: true,
      _count: { select: { users: true, invitations: true } },
    },
  });
  if (!existing) throw notFound('Role');
  if (existing.isSystem) {
    throw badRequest('The built-in roles cannot be deleted', 'SYSTEM_ROLE');
  }

  const holders = existing._count.users + existing._count.invitations;
  let destination: { id: string; name: string } | null = null;

  if (holders > 0) {
    if (!reassignToRoleId) {
      throw badRequest(
        'Choose a role to move the current holders to before deleting this one',
        'ROLE_IN_USE',
      );
    }
    destination = await prisma.role.findFirst({
      where: { id: reassignToRoleId, organizationId: actor.organizationId, key: { not: 'OWNER' } },
      select: { id: true, name: true },
    });
    if (!destination) throw notFound('Role');
    if (destination.id === roleId) {
      throw badRequest('Pick a different role to move people to', 'ROLE_IN_USE');
    }
  }

  await prisma.$transaction(async (tx) => {
    if (destination) {
      await tx.user.updateMany({ where: { roleId }, data: { roleId: destination.id } });
      await tx.invitation.updateMany({ where: { roleId }, data: { roleId: destination.id } });
    }
    await tx.role.delete({ where: { id: roleId } });
    await recordWorkspaceEvent(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      type: 'ROLE_DELETED',
      metadata: { subject: existing.name, role: destination?.name },
    });
  });

  logger.info({ organizationId: actor.organizationId, roleId, holders }, 'role deleted');
}
