import { z } from 'zod';
import { PERMISSIONS, type Permission, type RoleKey } from './enums.js';
import { requiredTrimmed } from './common.js';
import { msg } from './message.js';

/**
 * Roles, as the workspace defines them.
 *
 * ## Why a role is a row
 *
 * "Admin" was a hard-coded tier, which meant every workspace got the same three
 * shapes whether or not they matched how the team actually works. A role is now
 * a named permission set the owner controls: a workspace can have a "Regional
 * manager" who edits every lead but cannot touch the team, or a "Read-only
 * auditor" who holds nothing at all.
 *
 * ## What stays fixed
 *
 * The three seeded roles cannot be deleted — something has to be assignable,
 * and the owner role has to exist — but they can be renamed in both languages,
 * and the admin and member ones can have their permissions changed. The owner
 * role cannot be edited at all: its permission set is "everything", and a
 * workspace whose owner had removed their own ability to manage the team would
 * be one nobody could administer.
 */

export const permissionSchema = z.enum(PERMISSIONS);

export const createRoleSchema = z.object({
  name: requiredTrimmed('field.roleName', 40, 2),
  /** Falls back to `name` when the workspace does not care about Arabic. */
  nameAr: z.string().trim().max(40).optional(),
  permissions: z.array(permissionSchema).max(PERMISSIONS.length).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type CreateRoleFormValues = z.input<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: requiredTrimmed('field.roleName', 40, 2).optional(),
    nameAr: z.string().trim().max(40).optional(),
    permissions: z.array(permissionSchema).max(PERMISSIONS.length).optional(),
  })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/**
 * Deleting a role has to say where its holders go.
 *
 * A role with people in it cannot simply vanish — every account needs one — so
 * the caller names the role to move them to. Making that explicit beats picking
 * a default on their behalf and silently changing what somebody can do.
 */
export const deleteRoleSchema = z.object({
  reassignToRoleId: z.string().min(1).max(64).optional(),
});
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;

export interface RoleDto {
  id: string;
  /** Null for a role the workspace created. */
  key: RoleKey | null;
  name: string;
  nameAr: string;
  permissions: Permission[];
  /** The seeded three: renameable, never deletable. */
  isSystem: boolean;
  /** How many accounts currently hold it, so the UI can warn before deleting. */
  memberCount: number;
  /**
   * Everything that points at this role — accounts *and* invitations, including
   * settled ones. Deleting is refused without a destination while this is
   * above zero, so the dialog asks for one exactly when the API requires it.
   */
  referenceCount: number;
  order: number;
}

/** The permissions the *caller* holds, for the client to gate its own UI. */
export interface ViewerAccessDto {
  permissions: Permission[];
  isOwner: boolean;
}
