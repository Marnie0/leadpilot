import { PERMISSIONS, type Permission } from '@leadpilot/shared';

/**
 * Who may do what.
 *
 * ## What changed, and why
 *
 * These checks used to ask "is this person an ADMIN?". They now ask "does this
 * person's role carry this permission?" — because a workspace can define its
 * own roles, and a question phrased against a fixed tier cannot answer for a
 * role somebody invented this morning.
 *
 * The permission set is resolved once per request in `requireAuth`, off the
 * role row, alongside the user lookup that was already happening. So a role
 * edited in one tab takes effect on the very next request in another, with no
 * token to invalidate — the same reasoning that already had deactivation take
 * effect immediately rather than at token expiry.
 *
 * ## What is not a permission
 *
 * Managing roles, transferring ownership and deleting the workspace belong to
 * the owner and are not grantable. A permission that could be granted to
 * yourself is not a permission: anyone able to edit roles could hand themselves
 * every other one, so the three powers that would make that possible sit
 * outside the system entirely, behind `isOwner`.
 */

/** The minimum a permission check needs to know about the caller. */
export interface Viewer {
  userId: string;
  /** Resolved from the caller's role row, once, in `requireAuth`. */
  permissions: Permission[];
  /** Ownership is not a permission — see the note above. */
  isOwner: boolean;
}

/** True when the caller's role carries this permission, or they own the place. */
export function can(
  viewer: Pick<Viewer, 'permissions' | 'isOwner'>,
  permission: Permission,
): boolean {
  // The owner is never locked out of their own workspace by a role edit.
  if (viewer.isOwner) return true;
  return viewer.permissions.includes(permission);
}

/** True only for the account that owns the workspace. */
export function isOwner(viewer: Pick<Viewer, 'isOwner'>): boolean {
  return viewer.isOwner;
}

/**
 * Write authorisation for a single lead.
 *
 * A role with `EDIT_ALL_LEADS` may change any lead in the workspace; everybody
 * else may change the leads they own — assigned to them, or created by them.
 * Reads are deliberately unrestricted within the organisation: a shared
 * pipeline is the point of the product.
 *
 * This lives here rather than inside the leads service because two callers need
 * the identical answer: the service, which enforces it, and the serializer,
 * which reports it to the client as `canEdit` so the UI can grey out an action
 * instead of letting the user discover a 403 by trying. Two copies of this rule
 * would eventually disagree, and the disagreement would look like a bug in
 * whichever half the user noticed second.
 */
export function canMutateLead(
  viewer: Viewer,
  lead: { assignedToId: string | null; createdById?: string | null },
): boolean {
  if (can(viewer, 'EDIT_ALL_LEADS')) return true;
  return lead.assignedToId === viewer.userId || lead.createdById === viewer.userId;
}

/**
 * Write authorisation for a single follow-up.
 *
 * Wider than the task's own assignment on purpose. A follow-up is a note about
 * a lead, and the person working that lead is the person who finds out whether
 * it happened — so a rep may complete or reschedule a task on a lead of theirs
 * even when it was booked for a colleague, and a task booked *for* them on
 * somebody else's lead. Anything narrower produces the situation where the only
 * person who knows the call was made cannot say so.
 */
export function canMutateFollowUp(
  viewer: Viewer,
  followUp: {
    assignedToId: string | null;
    createdById?: string | null;
    lead: { assignedToId: string | null; createdById?: string | null };
  },
): boolean {
  if (followUp.assignedToId === viewer.userId) return true;
  // The creator too, exactly as `canMutateLead` counts a lead's creator.
  // Booking a follow-up is open to any member — the same as leaving a note —
  // so without this a rep could schedule a call on a colleague's lead, assign
  // it to a third person, and then be unable to cancel the thing they had just
  // created.
  if (followUp.createdById === viewer.userId) return true;
  return canMutateLead(viewer, followUp.lead);
}

/**
 * Whether `granter` may put somebody into `role`.
 *
 * You cannot grant permissions you do not hold. Without this, an admin with
 * MANAGE_TEAM could create nothing — but could assign somebody to a role that
 * carries CHANGE_CURRENCY and then act through them, which is privilege
 * escalation with one extra step. The owner is exempt because the owner holds
 * everything by definition.
 */
export function canGrantRole(
  granter: Pick<Viewer, 'permissions' | 'isOwner'>,
  role: { permissions: Permission[] },
): boolean {
  if (granter.isOwner) return true;

  // You cannot hand out a permission you do not hold yourself.
  if (!role.permissions.every((permission) => granter.permissions.includes(permission))) {
    return false;
  }

  /*
   * And you cannot hand out team management, even though you hold it.
   *
   * This is the rule "only the owner can make somebody an admin", restated so
   * it still means something once roles are arbitrary. The first check alone
   * would let an admin invite another admin — their permission sets are
   * identical, so "nothing you do not hold" is satisfied — and an authority
   * that can clone itself is not delegated, it is transferred. Growing the set
   * of people who can grant roles stays the owner's decision.
   */
  return !role.permissions.includes('MANAGE_TEAM');
}

/** Everything, for the seeded owner role. */
export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];
