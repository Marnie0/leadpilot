import type { Prisma } from '@prisma/client';
import {
  AI_MAX_ATTENTION,
  AI_MAX_TRENDS,
  type AiAttentionItemDto,
  type AiTrendItemDto,
  type AiUsageDto,
  type GenerateWorkspaceSummaryInput,
  type Locale,
  type WorkspaceSummaryDto,
  type WorkspaceSummaryResultDto,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { dayWindow, normaliseTimeZone } from '../../lib/day-window.js';
import { logger } from '../../logger.js';
import type { Actor } from '../leads/leads.service.js';
import { analyseWorkspace } from './ai.provider.js';
import {
  buildWorkspacePrompt,
  fingerprintWorkspace,
  type WorkspaceFacts,
} from './ai.workspace-prompt.js';
import {
  countToday,
  limitFor,
  loadOrganization,
  recordUsage,
  releaseProviderSlot,
  reserveProviderSlot,
  resolveLocale,
  usageFrom,
} from './ai.service.js';
import { env } from '../../env.js';

/**
 * The whole-workspace briefing.
 *
 * Shares every guardrail with the per-lead assistant — the workspace opt-in,
 * the provider key, the per-workspace daily budget, the per-minute ceiling —
 * because they draw on the same key and the same quota. The guards live in
 * `ai.service.ts` and are imported rather than repeated, so there is one
 * definition of "may this workspace spend a call right now".
 *
 * ## Who may generate one
 *
 * Any member. This is deliberately looser than the per-lead assistant, which
 * takes the lead's write rule: a lead analysis replaces an assessment somebody
 * else may be working from, whereas this replaces a shared briefing about data
 * every member can already see in full on the dashboard. A rep who spots that
 * eleven follow-ups are overdue is exactly who should be looking. The budget
 * remains the control on cost.
 */

/** Leads untouched for this long are worth naming individually. */
const STALL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many exception rows go into the prompt. Enough to be specific, not a table. */
const EXCEPTION_LIMIT = 5;

const SUMMARY_SELECT = {
  id: true,
  locale: true,
  headline: true,
  attention: true,
  trends: true,
  nextStep: true,
  model: true,
  inputHash: true,
  updatedAt: true,
  generatedBy: { select: { id: true, name: true } },
} satisfies Prisma.WorkspaceSummarySelect;

type SummaryRow = Prisma.WorkspaceSummaryGetPayload<{ select: typeof SUMMARY_SELECT }>;

function toDto(row: SummaryRow, currentHash: string): WorkspaceSummaryDto {
  return {
    id: row.id,
    locale: row.locale,
    headline: row.headline,
    // Stored as JSON, so it is re-checked on the way out rather than trusted:
    // a row written by an older shape must not crash the card that reads it.
    attention: Array.isArray(row.attention)
      ? (row.attention as unknown as AiAttentionItemDto[]).slice(0, AI_MAX_ATTENTION)
      : [],
    trends: Array.isArray(row.trends)
      ? (row.trends as unknown as AiTrendItemDto[]).slice(0, AI_MAX_TRENDS)
      : [],
    nextStep: row.nextStep,
    generatedAt: row.updatedAt.toISOString(),
    generatedBy: row.generatedBy,
    isStale: row.inputHash !== currentHash,
  };
}

/**
 * Everything the briefing is written from.
 *
 * Every figure here comes from the same kind of query the dashboard uses, so
 * the summary and the screen beside it cannot disagree. The model is never
 * asked to count: it is asked to say what the counts mean.
 */
async function loadFacts(actor: Actor, tz: string | undefined): Promise<WorkspaceFacts> {
  const organizationId = actor.organizationId;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { defaultCurrency: true },
  });
  if (!organization) throw notFound('Workspace');

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since60 = new Date(now.getTime() - 60 * DAY_MS);
  const stalledBefore = new Date(now.getTime() - STALL_DAYS * DAY_MS);
  const { startOfToday, endOfToday } = dayWindow(normaliseTimeZone(tz), now);

  const live: Prisma.LeadWhereInput = { organizationId, archivedAt: null, deletedAt: null };

  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId },
    select: { id: true, key: true, type: true, order: true },
    orderBy: { order: 'asc' },
  });
  const openStageIds = stages.filter((stage) => stage.type === 'OPEN').map((stage) => stage.id);
  const openLead: Prisma.LeadWhereInput = { ...live, stageId: { in: openStageIds } };

  const [
    stageGroups,
    currencyGroups,
    won30,
    lost30,
    created30,
    createdPrev30,
    overdue,
    dueToday,
    unassigned,
    stalled,
    biggest,
    sourceGroups,
    teamSize,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ['stageId'],
      where: live,
      _count: { _all: true },
      _sum: { estimatedValue: true },
      _avg: { boardPosition: true },
      orderBy: { stageId: 'asc' },
    }),
    prisma.lead.groupBy({
      by: ['currency'],
      where: openLead,
      _sum: { estimatedValue: true },
      orderBy: { currency: 'asc' },
    }),
    prisma.lead.aggregate({
      where: { ...live, wonAt: { gte: since30 } },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    prisma.lead.count({ where: { ...live, lostAt: { gte: since30 } } }),
    prisma.lead.count({ where: { ...live, createdAt: { gte: since30 } } }),
    prisma.lead.count({ where: { ...live, createdAt: { gte: since60, lt: since30 } } }),
    prisma.followUp.count({
      where: {
        organizationId,
        status: 'PENDING',
        deletedAt: null,
        lead: { deletedAt: null, archivedAt: null },
        dueAt: { lt: startOfToday },
      },
    }),
    prisma.followUp.count({
      where: {
        organizationId,
        status: 'PENDING',
        deletedAt: null,
        lead: { deletedAt: null, archivedAt: null },
        dueAt: { gte: startOfToday, lte: endOfToday },
      },
    }),
    prisma.lead.count({ where: { ...openLead, assignedToId: null } }),
    prisma.lead.findMany({
      where: {
        ...openLead,
        OR: [{ lastActivityAt: { lt: stalledBefore } }, { lastActivityAt: null }],
      },
      select: {
        customerName: true,
        requestedService: true,
        estimatedValue: true,
        currency: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { estimatedValue: 'desc' },
      take: EXCEPTION_LIMIT,
    }),
    prisma.lead.findMany({
      where: openLead,
      select: {
        customerName: true,
        requestedService: true,
        estimatedValue: true,
        currency: true,
        assignedToId: true,
        stage: { select: { key: true } },
      },
      orderBy: { estimatedValue: 'desc' },
      take: EXCEPTION_LIMIT,
    }),
    prisma.lead.groupBy({
      by: ['source'],
      where: { ...live, createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { source: 'asc' },
    }),
    prisma.user.count({ where: { organizationId, isActive: true } }),
  ]);

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const wonStageIds = new Set(stages.filter((s) => s.type === 'WON').map((s) => s.id));

  // Won counts per source need the stage type, which the grouped query above
  // does not carry — a second small grouped read rather than pulling rows.
  const wonBySource = await prisma.lead.groupBy({
    by: ['source'],
    where: { ...live, createdAt: { gte: since30 }, stageId: { in: [...wonStageIds] } },
    _count: { _all: true },
    orderBy: { source: 'asc' },
  });
  const wonCountBySource = new Map(wonBySource.map((row) => [row.source, row._count._all]));

  const daysSince = (value: Date | null, fallback: Date): number =>
    Math.floor((now.getTime() - (value ?? fallback).getTime()) / DAY_MS);

  const openValue = currencyGroups.reduce(
    (sum, row) => sum + (row._sum.estimatedValue?.toNumber() ?? 0),
    0,
  );

  return {
    currency: organization.defaultCurrency,
    teamSize,
    totalOpen: stageGroups
      .filter((group) => stageById.get(group.stageId)?.type === 'OPEN')
      .reduce((sum, group) => sum + group._count._all, 0),
    // The plain sum is only quoted when there is one currency; otherwise the
    // per-currency list below is what the prompt shows, and the instruction
    // tells the model not to add across them.
    openValue,
    valueByCurrency: currencyGroups.map((row) => ({
      currency: row.currency,
      amount: row._sum.estimatedValue?.toNumber() ?? 0,
    })),
    wonLast30: won30._count._all,
    wonValueLast30: won30._sum.estimatedValue?.toNumber() ?? 0,
    lostLast30: lost30,
    createdLast30: created30,
    createdPrevious30: createdPrev30,
    byStage: stageGroups
      .map((group) => ({
        stage: stageById.get(group.stageId)?.key ?? 'UNKNOWN',
        order: stageById.get(group.stageId)?.order ?? 0,
        count: group._count._all,
        value: group._sum.estimatedValue?.toNumber() ?? 0,
        avgAgeDays: null as number | null,
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...rest }) => rest),
    overdueFollowUps: overdue,
    dueTodayFollowUps: dueToday,
    unassignedOpen: unassigned,
    stalled: stalled.map((lead) => ({
      name: lead.customerName,
      service: lead.requestedService,
      value: lead.estimatedValue.toNumber(),
      currency: lead.currency,
      days: daysSince(lead.lastActivityAt, lead.createdAt),
    })),
    biggestOpen: biggest.map((lead) => ({
      name: lead.customerName,
      service: lead.requestedService,
      value: lead.estimatedValue.toNumber(),
      currency: lead.currency,
      stage: lead.stage.key,
      assigned: lead.assignedToId !== null,
    })),
    topSources: sourceGroups
      .map((row) => ({
        source: row.source,
        created: row._count._all,
        won: wonCountBySource.get(row.source) ?? 0,
      }))
      .sort((a, b) => b.created - a.created)
      .slice(0, 6),
  };
}

/** Reads the stored briefing. Never calls the provider. */
export async function getSummary(
  actor: Actor,
  tz: string | undefined,
): Promise<WorkspaceSummaryResultDto> {
  const [facts, row, usage] = await Promise.all([
    loadFacts(actor, tz),
    prisma.workspaceSummary.findUnique({
      where: { organizationId: actor.organizationId },
      select: SUMMARY_SELECT,
    }),
    usageFrom(actor),
  ]);

  if (!row) return { summary: null, usage };
  // Fingerprinted against the stored briefing's own language and model, not the
  // reader's — otherwise opening an English summary in Arabic would report the
  // workspace as changed, which is not what happened.
  return { summary: toDto(row, fingerprintWorkspace(facts, row.locale, row.model)), usage };
}

export async function generateSummary(
  actor: Actor,
  input: GenerateWorkspaceSummaryInput,
  tz: string | undefined,
): Promise<WorkspaceSummaryResultDto> {
  const locale: Locale = input.locale ?? (await resolveLocale(actor));

  const organization = await loadOrganization(actor);
  if (!organization.aiEnabled) {
    throw forbidden('The assistant is switched off for this workspace', 'AI_DISABLED');
  }
  if (!env.aiConfigured) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'The assistant is not configured on this server.');
  }

  const usedToday = await countToday(actor.organizationId);
  if (usedToday >= limitFor(organization)) {
    throw new AppError(
      429,
      'AI_QUOTA_EXCEEDED',
      'This workspace has used its analyses for today. They refresh 24 hours after each one.',
    );
  }

  const facts = await loadFacts(actor, tz);

  const slot = reserveProviderSlot();
  let analysis;
  let model;
  try {
    ({ analysis, model } = await analyseWorkspace(buildWorkspacePrompt(facts, locale)));
  } catch (error) {
    releaseProviderSlot(slot);
    logger.warn({ err: error, organizationId: actor.organizationId }, 'workspace summary failed');
    throw error;
  }

  await recordUsage(actor, null, model);

  const data = {
    locale,
    headline: analysis.headline,
    attention: analysis.attention as unknown as Prisma.InputJsonValue,
    trends: analysis.trends as unknown as Prisma.InputJsonValue,
    nextStep: analysis.nextStep,
    model,
    inputHash: fingerprintWorkspace(facts, locale, model),
    generatedById: actor.userId,
  };

  const row = await prisma.workspaceSummary.upsert({
    where: { organizationId: actor.organizationId },
    create: { organizationId: actor.organizationId, ...data },
    update: data,
    select: SUMMARY_SELECT,
  });

  return { summary: toDto(row, row.inputHash), usage: await usageFrom(actor) };
}

/** Discards the stored briefing. Manager-only: it is a workspace-level artefact. */
export async function deleteSummary(actor: Actor): Promise<void> {
  const { isManager } = await import('../../lib/permissions.js');
  if (!isManager(actor)) {
    throw forbidden('Only an owner or admin can discard the workspace summary', 'MANAGER_ONLY');
  }
  await prisma.workspaceSummary.deleteMany({ where: { organizationId: actor.organizationId } });
}

export type { AiUsageDto };
