import type { Prisma } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS } from '@leadpilot/shared';

/**
 * The three roles every new workspace starts with.
 *
 * One definition, used by sign-up, the seed script and the demo clone, so a
 * workspace created by any route has the same starting shape — and so the
 * permission sets stay identical to what the migration backfilled for
 * workspaces that predate roles.
 *
 * The labels are defaults, not fixtures: an owner may rename any of them. Only
 * `key` is load-bearing, because code needs to be able to find "the member role
 * of this workspace" to assign an invitee, whatever it has since been called.
 */
export const DEFAULT_ROLES: Prisma.RoleCreateWithoutOrganizationInput[] = [
  {
    key: 'OWNER',
    name: 'Owner',
    nameAr: 'المالك',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.OWNER],
    isSystem: true,
    order: 0,
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    nameAr: 'مشرف',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.ADMIN],
    isSystem: true,
    order: 1,
  },
  {
    // "Sales rep" rather than "Member": it is what this product's third role
    // actually is, and the label is the first thing a workspace reads.
    key: 'MEMBER',
    name: 'Sales rep',
    nameAr: 'مندوب مبيعات',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.MEMBER],
    isSystem: true,
    order: 2,
  },
];
