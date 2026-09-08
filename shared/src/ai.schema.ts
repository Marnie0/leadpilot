import { z } from 'zod';
import { LOCALES, type FollowUpChannel } from './enums.js';

/**
 * The AI lead assistant.
 *
 * ## What it is asked to do
 *
 * One call produces one structured read of a lead: what the customer actually
 * asked for, how good and how urgent the opportunity looks, what to do next,
 * and a message the rep could send as-is. Those five things arrive together
 * because they are one judgement — a "next action" that disagrees with the
 * urgency it was scored at is worse than no suggestion at all.
 *
 * ## Why the result is stored rather than streamed on every view
 *
 * The analysis is a `LeadInsight` row keyed to the lead, not a call made when
 * the page opens. Three reasons, in order of how much they matter:
 *
 *  1. **It is a shared artefact.** A rep and their manager opening the same
 *     lead need to be looking at the same assessment. Regenerating per viewer
 *     produces two different scores for one lead and no way to say which was
 *     acted on.
 *  2. **Cost control is structural, not hopeful.** Reading a lead costs
 *     nothing; only an explicit re-run spends quota. Somebody clicking through
 *     the demo cannot exhaust the key no matter how fast they click.
 *  3. **It is auditable.** `generatedAt`, `model` and the actor are on the row,
 *     so "the AI said this was urgent" has a timestamp and a version attached.
 *
 * The cost is staleness, which is why `inputHash` exists: the fields the
 * analysis was made from are fingerprinted, and the card says so when the lead
 * has moved on since.
 */

/** How soon this needs a human, as judged from the inquiry. */
export const AI_URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type AiUrgency = (typeof AI_URGENCIES)[number];

/** Coarse bands over `qualityScore`, so the UI is not inventing its own. */
export const AI_QUALITY_BANDS = ['WEAK', 'MODERATE', 'STRONG', 'EXCELLENT'] as const;
export type AiQualityBand = (typeof AI_QUALITY_BANDS)[number];

/**
 * The band a score falls in.
 *
 * Shared rather than duplicated in the UI because the badge colour and the
 * screen-reader label have to agree, and because the server stamps the band
 * into the activity trail when an analysis is recorded.
 */
export function qualityBand(score: number): AiQualityBand {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'STRONG';
  if (score >= 35) return 'MODERATE';
  return 'WEAK';
}

/** Upper bound on how many signals the model may return, enforced both ways. */
export const AI_MAX_SIGNALS = 5;

export interface LeadInsightDto {
  id: string;
  leadId: string;
  /** Language the prose was written in — the requester's, at generation time. */
  locale: (typeof LOCALES)[number];
  /** Two or three sentences: what this customer is asking for. */
  summary: string;
  /** 0-100. Deliberately a number, so it can be sorted and compared. */
  qualityScore: number;
  qualityBand: AiQualityBand;
  urgency: AiUrgency;
  /** Why it scored that way — the part that makes the score arguable. */
  rationale: string;
  /** Short, concrete, and something a person can do today. */
  nextAction: string;
  /** Which channel the next action should happen on. */
  nextActionChannel: FollowUpChannel;
  /** A ready-to-send follow-up, in `locale`, addressed to the customer. */
  draftMessage: string;
  /** Up to AI_MAX_SIGNALS short phrases the judgement rested on. */
  signals: string[];
  model: string;
  generatedAt: string;
  generatedBy: { id: string; name: string } | null;
  /**
   * True when the lead has changed since this was written.
   *
   * Computed on read by comparing the stored fingerprint against the lead as it
   * is now, rather than invalidated on write. An analysis that is out of date
   * is still worth reading — it is what somebody acted on yesterday — so it is
   * labelled, never discarded.
   */
  isStale: boolean;
}

/**
 * Regenerating is a POST with no body; this exists so the client and server
 * agree that it takes none, and so adding an option later has a home.
 */
export const generateInsightSchema = z.object({
  /** Language to write in. Defaults to the caller's own locale. */
  locale: z.enum(LOCALES).optional(),
});
export type GenerateInsightInput = z.infer<typeof generateInsightSchema>;

/**
 * What the workspace is allowed to spend, and what it has spent today.
 *
 * Surfaced to the client because "you have used your analyses for today" is a
 * sentence the UI has to be able to say *before* the button is pressed, and
 * because a limit nobody can see reads as a bug.
 */
export interface AiUsageDto {
  /** False when the workspace has not switched the assistant on. */
  enabled: boolean;
  /**
   * False when the deployment has no provider key. Distinct from `enabled`:
   * one is the workspace's choice, the other is the operator's, and the UI
   * says something different about each.
   */
  configured: boolean;
  usedToday: number;
  dailyLimit: number;
  remaining: number;
}

/** Assistant settings, as the workspace owner sees them. */
export interface AiSettingsDto extends AiUsageDto {
  /** Which model the deployment is pointed at; shown so the page is honest. */
  model: string;
  /**
   * True when the provider's free tier trains on what is sent to it, so the
   * settings screen can say so rather than leaving it in a README nobody reads.
   */
  providerTrainsOnInput: boolean;
  providerName: string;
}

export const updateAiSettingsSchema = z.object({
  enabled: z.boolean(),
});
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
