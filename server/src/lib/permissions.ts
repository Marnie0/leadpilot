import { MANAGER_ROLES, type UserRole } from '@leadpilot/shared';

/** The minimum a permission check needs to know about the caller. */
export interface Viewer {
  userId: string;
  role: string;
}

/** True for OWNER and ADMIN — the roles that administer the workspace. */
export function isManager(viewer: Pick<Viewer, 'role'>): boolean {
  return MANAGER_ROLES.includes(viewer.role as UserRole);
}

/**
 * Write authorisation for a single lead.
 *
 * Owners and admins may change any lead in the workspace; a rep may only change
 * the leads they own — assigned to them, or created by them. Reads are
 * deliberately unrestricted within the organisation: a shared pipeline is the
 * point of the product.
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
  if (isManager(viewer)) return true;
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
  if (isManager(viewer)) return true;
  if (followUp.assignedToId === viewer.userId) return true;
  // The creator too, exactly as `canMutateLead` counts a lead's creator.
  // Booking a follow-up is open to any member — the same as leaving a note —
  // so without this a rep could schedule a call on a colleague's lead, assign
  // it to a third person, and then be unable to cancel the thing they had just
  // created.
  if (followUp.createdById === viewer.userId) return true;
  return canMutateLead(viewer, followUp.lead);
}
