import {
  qualityBand,
  type AiSettingsDto,
  type AiUsageDto,
  type GenerateInsightInput,
  type LeadInsightDto,
  type Locale,
  type UpdateAiSettingsInput,
} from '@leadpilot/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { can, canMutateLead } from '../../lib/permissions.js';
import { logger } from '../../logger.js';
import type { Actor } from '../leads/leads.service.js';
import { PROVIDER_NAME, PROVIDER_TRAINS_ON_INPUT, analyse } from './ai.provider.js';
import { buildPrompt, fingerprint, type LeadFacts } from './ai.prompt.js';

/**
 * Orchestration for the lead assistant: who may ask, whether there is budget,
 * what gets stored, and what the browser is told when any of that says no.
 *
 * The ordering of the guards below is deliberate and is the whole reason a
 * client clicking around cannot embarrass the app:
 *
 *   read the lead  →  may this person write to it
 *                  →  is it still a live lead
 *                  →  is the assistant on for this workspace
 *                  →  is a key configured at all
 *                  →  has this workspace spent today's allowance
 *                  →  are we about to exceed the provider's per-minute rate
 *                  →  only then, spend a call
 *
 * The cheap, local refusals come first so a request that was never going to be
 * allowed does not reach a third party. Every one of them has its own error
 * code, because "not yours", "off", "not set up", "you have used your 25 for
 * today" and "busy, try again in a moment" are five different sentences and
 * only one of them means try again immediately.
 */

/** Activity kinds a human wrote, which are the only ones worth feeding a model. */
const NOTE_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP'] as const;

/** How many timeline entries go into the prompt. Newest first. */
const NOTE_LIMIT = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-process guard against the provider's requests-per-minute ceiling.
 *
 * Free-tier Flash-Lite allows 15/minute; this stays under it with room to
 * spare. Per-instance and therefore approximate on a serverless deployment —
 * which is fine, because it is the *second* line of defence. The per-workspace
 * daily budget below is the real one, and it is counted in the database, so it
 * is exact and survives a cold start.
 */
const PROVIDER_RPM = 10;
const recentCalls: number[] = [];

export function reserveProviderSlot(): number {
  const cutoff = Date.now() - 60_000;
  while (recentCalls.length > 0 && (recentCalls[0] ?? 0) < cutoff) recentCalls.shift();
  if (recentCalls.length >= PROVIDER_RPM) {
    throw new AppError(429, 'AI_RATE_LIMITED', 'The assistant is busy. Try again in a moment.');
  }
  const token = Date.now();
  recentCalls.push(token);
  return token;
}

/**
 * Releases a slot when the call never reached the provider.
 *
 * Removes *this* reservation by its token rather than popping the end of the
 * queue: two analyses can be in flight at once, and popping would hand back a
 * slot still being used by whichever one has not finished.
 */
export function releaseProviderSlot(token: number): void {
  const index = recentCalls.lastIndexOf(token);
  if (index !== -1) recentCalls.splice(index, 1);
}

export async function loadOrganization(actor: Actor) {
  const organization = await prisma.organization.findUnique({
    where: { id: actor.organizationId },
    select: { aiEnabled: true, isDemo: true },
  });
  if (!organization) throw notFound('Workspace');
  return organization;
}

/**
 * The daily allowance for a workspace.
 *
 * A demo sandbox gets a fraction of a real workspace's, because every visitor
 * gets a sandbox of their own and all of them draw on one free-tier key. The
 * limit is per workspace either way; this is what stops "per workspace" from
 * meaning "unbounded in total" on the one deployment where workspaces are
 * created by strangers.
 */
export const limitFor = (organization: { isDemo: boolean }): number =>
  organization.isDemo ? env.AI_DEMO_DAILY_LIMIT : env.AI_DAILY_LIMIT_PER_ORG;

/** The caller's own language preference, for a request that did not name one. */
export async function resolveLocale(actor: Actor): Promise<Locale> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { locale: true },
  });
  return user?.locale ?? 'en';
}

/**
 * What this workspace has spent in the last 24 hours.
 *
 * Counted from `AiUsageEvent` rather than from the analyses themselves. The
 * obvious implementation — count `LeadInsight` rows written today — is wrong in
 * a way that only shows up if you look for it: discarding an analysis deletes
 * the row, which hands the quota back, so generate-then-discard is an unlimited
 * loop against a shared free-tier key.
 */
export async function countToday(organizationId: string): Promise<number> {
  return prisma.aiUsageEvent.count({
    where: { organizationId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
}

/**
 * Drops usage rows older than the counting window.
 *
 * Runs from the daily housekeeping job. The window is doubled before deleting
 * so a row is never removed while it could still be counted — an off-by-one
 * here would quietly refund quota, which is the bug this table exists to fix.
 */
export async function purgeExpiredAiUsage(now = new Date()): Promise<number> {
  const { count } = await prisma.aiUsageEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY_MS) } },
  });
  return count;
}

/**
 * A rolling 24-hour window rather than a calendar day.
 *
 * Calendar days need a timezone to be meaningful, and the only honest one here
 * is the provider's quota reset (midnight Pacific), which is not a boundary any
 * user of this app would recognise. A rolling window needs no explanation:
 * whatever you used, you get back 24 hours later.
 */
/**
 * Records one provider call against the workspace's budget.
 *
 * Written before the artefact it produced, and outside any transaction that
 * could roll it back: the call has been made and paid for whether or not the
 * write that follows succeeds. `leadId` is null for the workspace briefing,
 * which belongs to no single lead.
 */
export async function recordUsage(
  actor: Actor,
  leadId: string | null,
  model: string,
): Promise<void> {
  await prisma.aiUsageEvent.create({
    data: { organizationId: actor.organizationId, userId: actor.userId, leadId, model },
  });
}

/** Alias kept for the workspace service, which reads the same budget. */
export const usageFrom = (actor: Actor): Promise<AiUsageDto> => getUsage(actor);

export async function getUsage(actor: Actor): Promise<AiUsageDto> {
  const [organization, usedToday] = await Promise.all([
    loadOrganization(actor),
    countToday(actor.organizationId),
  ]);
  const dailyLimit = limitFor(organization);
  return {
    enabled: organization.aiEnabled,
    configured: env.aiConfigured,
    usedToday,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - usedToday),
  };
}

export async function getSettings(actor: Actor): Promise<AiSettingsDto> {
  return {
    ...(await getUsage(actor)),
    providerName: PROVIDER_NAME,
    providerTrainsOnInput: PROVIDER_TRAINS_ON_INPUT,
  };
}

/**
 * Switching the assistant on or off.
 *
 * Manager-only, and it is worth saying why this is not a per-user preference:
 * enabling it sends the workspace's lead text — somebody's customers' names and
 * enquiries — to a third party whose free tier trains on what it receives. That
 * is a decision about the workspace's data, so it belongs to the people who
 * administer the workspace, not to whoever happens to open the settings page.
 */
export async function updateSettings(
  actor: Actor,
  input: UpdateAiSettingsInput,
): Promise<AiSettingsDto> {
  if (!can(actor, 'MANAGE_AI')) {
    throw forbidden('Your role cannot change the assistant settings', 'MANAGER_ONLY');
  }
  await prisma.organization.update({
    where: { id: actor.organizationId },
    data: { aiEnabled: input.enabled },
  });
  return getSettings(actor);
}

const INSIGHT_SELECT = {
  id: true,
  leadId: true,
  locale: true,
  summary: true,
  qualityScore: true,
  urgency: true,
  rationale: true,
  nextAction: true,
  nextActionChannel: true,
  draftMessage: true,
  signals: true,
  model: true,
  inputHash: true,
  updatedAt: true,
  generatedBy: { select: { id: true, name: true } },
} satisfies Prisma.LeadInsightSelect;

type InsightRow = Prisma.LeadInsightGetPayload<{ select: typeof INSIGHT_SELECT }>;

function toDto(row: InsightRow, currentHash: string): LeadInsightDto {
  return {
    id: row.id,
    leadId: row.leadId,
    locale: row.locale,
    summary: row.summary,
    qualityScore: row.qualityScore,
    qualityBand: qualityBand(row.qualityScore),
    urgency: row.urgency,
    rationale: row.rationale,
    nextAction: row.nextAction,
    nextActionChannel: row.nextActionChannel,
    draftMessage: row.draftMessage,
    signals: row.signals,
    generatedAt: row.updatedAt.toISOString(),
    generatedBy: row.generatedBy,
    isStale: row.inputHash !== currentHash,
  };
}

/**
 * Loads the lead in the shape the prompt and the fingerprint both need.
 *
 * Scoped by `organizationId`, so another tenant's lead id is a 404 here exactly
 * as it is everywhere else. Archived and trashed leads are readable — the
 * detail page shows them, so the card on it has to render — but generating is
 * refused further down: spending a call on a record somebody has thrown away
 * is not a thing to do quietly.
 */
async function loadFacts(
  actor: Actor,
  leadId: string,
): Promise<{
  facts: LeadFacts;
  archived: boolean;
  trashed: boolean;
  lead: { assignedToId: string | null; createdById: string | null };
}> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
    select: {
      assignedToId: true,
      createdById: true,
      customerName: true,
      company: true,
      email: true,
      phone: true,
      requestedService: true,
      description: true,
      estimatedValue: true,
      currency: true,
      source: true,
      priority: true,
      tags: true,
      createdAt: true,
      lastContactedAt: true,
      archivedAt: true,
      deletedAt: true,
      stage: { select: { key: true } },
    },
  });
  if (!lead) throw notFound('Lead');

  const notes = await prisma.activity.findMany({
    where: { leadId, type: { in: [...NOTE_TYPES] }, body: { not: null } },
    select: { type: true, body: true, occurredAt: true },
    orderBy: { occurredAt: 'desc' },
    take: NOTE_LIMIT,
  });

  return {
    archived: lead.archivedAt !== null,
    trashed: lead.deletedAt !== null,
    lead: { assignedToId: lead.assignedToId, createdById: lead.createdById },
    facts: {
      customerName: lead.customerName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      requestedService: lead.requestedService,
      description: lead.description,
      estimatedValue: lead.estimatedValue.toNumber(),
      currency: lead.currency,
      source: lead.source,
      priority: lead.priority,
      stage: lead.stage.key,
      tags: lead.tags,
      createdAt: lead.createdAt,
      lastContactedAt: lead.lastContactedAt,
      recentNotes: notes.map((note) => ({
        type: note.type,
        // `body: { not: null }` above already guarantees this.
        body: note.body as string,
        occurredAt: note.occurredAt,
      })),
    },
  };
}

export interface InsightResult {
  insight: LeadInsightDto | null;
  usage: AiUsageDto;
}

/** Reads the stored analysis, if there is one. Never calls the provider. */
export async function getInsight(actor: Actor, leadId: string): Promise<InsightResult> {
  const [{ facts }, row, usage] = await Promise.all([
    loadFacts(actor, leadId),
    prisma.leadInsight.findFirst({
      where: { leadId, organizationId: actor.organizationId },
      select: INSIGHT_SELECT,
    }),
    getUsage(actor),
  ]);

  if (!row) return { insight: null, usage };
  // Fingerprinted against the *stored* analysis's own language and model, not
  // the reader's. Otherwise an Arabic speaker opening an English analysis would
  // be told the lead had changed, which is not what happened.
  const hash = fingerprint(facts, row.locale, row.model);
  return { insight: toDto(row, hash), usage };
}

export async function generateInsight(
  actor: Actor,
  leadId: string,
  input: GenerateInsightInput,
): Promise<InsightResult> {
  // The browser sends the language it is being read in. When it does not — a
  // direct API call — fall back to the caller's own saved preference rather
  // than to English, so the assistant answers an Arabic user in Arabic even
  // when the request did not say so.
  const locale: Locale = input.locale ?? (await resolveLocale(actor));

  const { facts, archived, trashed, lead } = await loadFacts(actor, leadId);

  /*
   * The same write rule as every other change to a lead.
   *
   * Reading an analysis stays open to the whole workspace — a shared pipeline
   * is the point of the product — but *generating* one is a write: it replaces
   * whatever assessment was on the record and spends the workspace's shared
   * budget doing it. Leaving it open would let a rep overwrite the analysis a
   * colleague is working from, on a lead they cannot otherwise touch.
   */
  if (!canMutateLead(actor, lead)) {
    throw forbidden('You can only analyse leads assigned to you');
  }

  if (trashed || archived) {
    throw new AppError(
      409,
      'LEAD_NOT_ACTIVE',
      'Restore this lead before asking the assistant about it.',
    );
  }

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

  const slot = reserveProviderSlot();
  let analysis;
  let model;
  try {
    ({ analysis, model } = await analyse(buildPrompt(facts, locale)));
  } catch (error) {
    // The call never produced anything, so it should not hold a slot for a
    // minute — otherwise a provider outage locks the workspace out of retrying
    // long after the provider has recovered.
    releaseProviderSlot(slot);
    logger.warn({ err: error, leadId }, 'lead analysis failed');
    throw error;
  }

  await recordUsage(actor, leadId, model);

  const row = await prisma.leadInsight.upsert({
    where: { leadId },
    create: {
      organizationId: actor.organizationId,
      leadId,
      locale,
      ...analysis,
      model,
      inputHash: fingerprint(facts, locale, model),
      generatedById: actor.userId,
    },
    update: {
      locale,
      ...analysis,
      model,
      inputHash: fingerprint(facts, locale, model),
      generatedById: actor.userId,
    },
    select: INSIGHT_SELECT,
  });

  return { insight: toDto(row, row.inputHash), usage: await getUsage(actor) };
}

/**
 * Deleting an analysis.
 *
 * Same permission as editing the lead: an assessment sitting on a record is
 * part of what the workspace sees about it, and a rep who can change the lead
 * can decide the assistant's read of it is wrong and remove it.
 */
export async function deleteInsight(actor: Actor, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
    select: { assignedToId: true, createdById: true },
  });
  if (!lead) throw notFound('Lead');
  if (!canMutateLead(actor, lead)) {
    throw forbidden('You can only change leads assigned to you');
  }
  await prisma.leadInsight.deleteMany({ where: { leadId, organizationId: actor.organizationId } });
}
