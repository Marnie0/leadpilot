import type { Prisma, WorkspaceEventType } from '@prisma/client';
import type { WorkspaceEventDto } from '@leadpilot/shared';

export const WORKSPACE_EVENT_SELECT = {
  id: true,
  type: true,
  metadata: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.WorkspaceEventSelect;

type WorkspaceEventRow = Prisma.WorkspaceEventGetPayload<{
  select: typeof WORKSPACE_EVENT_SELECT;
}>;

/**
 * Appends a workspace-level audit entry.
 *
 * Takes the transaction client so the record and the change it describes commit
 * together: a conversion that succeeded without its log entry, or a log entry
 * for a conversion that rolled back, would both be worse than no log at all.
 */
export async function recordWorkspaceEvent(
  tx: Prisma.TransactionClient,
  entry: {
    organizationId: string;
    /**
     * Null when the actor is being removed by the very action being recorded —
     * an account deleting itself. The row's own FK is `SetNull` for the same
     * reason: the entry has to outlive the person it is about.
     */
    userId: string | null;
    type: WorkspaceEventType;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.workspaceEvent.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId,
      type: entry.type,
      ...(entry.metadata !== undefined && { metadata: entry.metadata }),
    },
  });
}

export function toWorkspaceEventDto(event: WorkspaceEventRow): WorkspaceEventDto {
  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const number = (value: unknown): number => (typeof value === 'number' ? value : 0);
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');

  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    actor: event.user ? { id: event.user.id, name: event.user.name } : null,
    ...(event.type === 'CURRENCY_CHANGED' && {
      currencyChange: {
        from: text(meta.from),
        to: text(meta.to),
        rate: number(meta.rate),
        leads: number(meta.leads),
      },
    }),
    // Everything else recorded here is about membership. The subject is stored
    // as a name rather than an id on purpose: the row it referred to may be
    // gone, and "Ahmed was removed" still has to read correctly afterwards.
    ...(event.type !== 'CURRENCY_CHANGED' && {
      membership: {
        subject: text(meta.subject),
        ...(meta.role !== undefined && { role: text(meta.role) }),
        ...(meta.previousRole !== undefined && { previousRole: text(meta.previousRole) }),
      },
    }),
  };
}
