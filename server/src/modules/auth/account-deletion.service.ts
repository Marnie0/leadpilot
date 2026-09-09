import {
  confirmationMatches,
  type AccountDeletionStatusDto,
  type DeleteAccountInput,
  type DeleteWorkspaceInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import { recordWorkspaceEvent } from '../../lib/workspace-events.js';
import { logger } from '../../logger.js';

/**
 * Closing your own account, and closing the workspace.
 *
 * ## What survives
 *
 * The account row goes; the workspace's memory of the work does not. Every
 * reference to a user from a lead, an activity or a follow-up is already
 * `onDelete: SetNull` rather than a cascade — a choice made long before this
 * feature existed, and exactly the right one for it. So a rep who leaves takes
 * their credentials with them and leaves the pipeline intact: their notes keep
 * their text and lose their author, their leads become unassigned, and nobody
 * else's history develops holes.
 *
 * Erasing the notes instead would take a colleague's context with them. Keeping
 * the name would be a record of somebody who asked to be removed. Neither is
 * better than an honest "a removed member".
 *
 * ## Why the owner is blocked
 *
 * A workspace has exactly one owner and the database enforces it, so an owner
 * deleting their account would leave a workspace nobody can administer — or,
 * more accurately, would be refused by a foreign key at an unhelpful moment.
 * They transfer first, or delete the whole workspace. The one exception is an
 * owner who is the *only* member: there is nobody to transfer to, so deleting
 * the account and deleting the workspace are the same act, and the API says so
 * rather than trapping them.
 *
 * ## Why a password, and not just a typed word
 *
 * Both are asked for. The typed confirmation is friction against a misclick;
 * the password is proof that the person at the keyboard is the account holder
 * and not somebody who found an unlocked laptop. The other irreversible actions
 * in this product destroy records that a colleague could recreate — this one
 * destroys the ability to sign in at all.
 */

async function loadActor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isOwner: true,
      organizationId: true,
      organization: { select: { id: true, name: true, isDemo: true, isDemoTemplate: true } },
    },
  });
  if (!user) throw unauthorized();
  return user;
}

/** Whether this account can be deleted right now, and why not if not. */
export async function accountDeletionStatus(userId: string): Promise<AccountDeletionStatusDto> {
  const user = await loadActor(userId);
  const otherMembers = await prisma.user.count({
    where: { organizationId: user.organizationId, id: { not: user.id }, isActive: true },
  });

  const isLastMember = otherMembers === 0;
  // An owner with colleagues has to hand the workspace over first. An owner
  // alone has nobody to hand it to, so their deletion takes the workspace with
  // it — which is offered as a choice rather than done by surprise.
  const blocked = user.isOwner && !isLastMember;

  return {
    canDelete: !blocked,
    reason: blocked ? 'OWNER_MUST_TRANSFER' : null,
    otherMembers,
    isLastMember,
  };
}

export async function deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
  const user = await loadActor(userId);

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Your password is incorrect', 'CURRENT_PASSWORD_INCORRECT');
  }
  if (!confirmationMatches(input.confirmEmail, user.email)) {
    throw badRequest('The email you typed does not match your account', 'CONFIRMATION_MISMATCH');
  }

  const status = await accountDeletionStatus(userId);
  if (!status.canDelete) {
    throw badRequest(
      'Transfer ownership or delete the workspace before deleting your account',
      'OWNER_MUST_TRANSFER',
    );
  }

  /*
   * The last member takes the workspace with them.
   *
   * Leaving an empty workspace behind would be a row nobody can ever sign into,
   * holding leads nobody can read — and the account being deleted is the only
   * thing that could have granted access to it.
   */
  if (status.isLastMember) {
    // Same guard as `deleteWorkspace`: every future sandbox is cloned from the
    // template, and deleting the account that happens to own it would take the
    // demo with it.
    if (user.organization.isDemoTemplate) {
      throw forbidden('The demo template cannot be deleted');
    }
    await prisma.$transaction(async (tx) => {
      // Re-counted inside the transaction: somebody accepting an invitation
      // between the check above and this delete would otherwise be destroyed
      // along with a workspace they had just joined.
      const others = await tx.user.count({
        where: { organizationId: user.organizationId, id: { not: user.id }, isActive: true },
      });
      if (others > 0) {
        throw conflict(
          'Somebody joined the workspace just now. Transfer ownership or delete the workspace before deleting your account',
          'OWNER_MUST_TRANSFER',
        );
      }
      await tx.organization.delete({ where: { id: user.organizationId } });
    });
    logger.info(
      { userId, organizationId: user.organizationId },
      'account deleted with its workspace — last member',
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Recorded before the row goes, and by name: the audit entry has to keep
    // reading correctly once the user it refers to no longer exists.
    await recordWorkspaceEvent(tx, {
      organizationId: user.organizationId,
      userId: null,
      type: 'ACCOUNT_DELETED',
      metadata: { subject: user.name },
    });
    /*
     * Conditional on still not being the owner. The status check above ran
     * before this transaction, and an ownership transfer can land in between:
     * the transfer commits, this delete removes the brand-new owner, and the
     * workspace is left with nobody who can transfer, delete, or manage roles.
     * The database's one-owner index cannot prevent zero owners; this can.
     * A row locked by the concurrent transfer is re-read once the lock frees,
     * so the condition is evaluated against the committed state.
     */
    const { count } = await tx.user.deleteMany({ where: { id: user.id, isOwner: false } });
    if (count === 0) {
      throw conflict(
        'You became the owner of this workspace just now. Transfer ownership or delete the workspace before deleting your account',
        'OWNER_MUST_TRANSFER',
      );
    }
  });

  logger.info({ organizationId: user.organizationId }, 'account deleted');
}

/**
 * Deleting the workspace. Owner only.
 *
 * Cascades to every member, lead, activity, follow-up, invitation and role.
 * There is no trash for this: the trash exists so a lead deleted by mistake can
 * come back, and it lives inside the workspace it would have to be restored to.
 */
export async function deleteWorkspace(userId: string, input: DeleteWorkspaceInput): Promise<void> {
  const user = await loadActor(userId);
  if (!user.isOwner) {
    throw forbidden('Only the workspace owner can delete the workspace', 'OWNER_ONLY');
  }
  if (user.organization.isDemoTemplate) {
    // Every future sandbox is cloned from it.
    throw forbidden('The demo template cannot be deleted');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Your password is incorrect', 'CURRENT_PASSWORD_INCORRECT');
  }
  if (!confirmationMatches(input.confirmName, user.organization.name)) {
    throw badRequest('The name you typed does not match this workspace', 'CONFIRMATION_MISMATCH');
  }

  const counts = await prisma.$transaction([
    prisma.user.count({ where: { organizationId: user.organizationId } }),
    prisma.lead.count({ where: { organizationId: user.organizationId } }),
  ]);

  await prisma.organization.delete({ where: { id: user.organizationId } });
  logger.warn(
    { organizationId: user.organizationId, members: counts[0], leads: counts[1] },
    'workspace deleted by its owner',
  );
}

/** What the confirmation screen shows before the workspace is destroyed. */
export async function workspaceDeletionSummary(userId: string): Promise<{
  name: string;
  members: number;
  leads: number;
}> {
  const user = await loadActor(userId);
  if (!user.isOwner) throw forbidden('Only the workspace owner can delete the workspace');
  const [members, leads] = await prisma.$transaction([
    prisma.user.count({ where: { organizationId: user.organizationId } }),
    prisma.lead.count({ where: { organizationId: user.organizationId } }),
  ]);
  if (!user.organization) throw notFound('Workspace');
  return { name: user.organization.name, members, leads };
}
