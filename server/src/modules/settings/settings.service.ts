import { Prisma } from '@prisma/client';
import {
  convertCurrency,
  type Currency,
  type CurrencyChangeResultDto,
  type CurrencyPreviewDto,
  type OrganizationSettingsDto,
  type UpdateOrganizationInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getRates } from '../fx/fx.service.js';
import type { Actor } from '../leads/leads.service.js';

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

export async function getOrganizationSettings(actor: Actor): Promise<OrganizationSettingsDto> {
  const [organization, members, leads, archivedLeads] = await prisma.$transaction([
    prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        defaultCurrency: true,
        defaultLocale: true,
        isDemo: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { organizationId: actor.organizationId, isActive: true } }),
    prisma.lead.count({ where: { organizationId: actor.organizationId, archivedAt: null } }),
    prisma.lead.count({
      where: { organizationId: actor.organizationId, archivedAt: { not: null } },
    }),
  ]);
  if (!organization) throw notFound('Workspace');

  return {
    ...organization,
    expiresAt: iso(organization.expiresAt),
    createdAt: organization.createdAt.toISOString(),
    counts: { members, leads, archivedLeads },
  };
}

export async function updateOrganization(
  actor: Actor,
  input: UpdateOrganizationInput,
): Promise<OrganizationSettingsDto> {
  await prisma.organization.update({
    where: { id: actor.organizationId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.defaultLocale !== undefined && { defaultLocale: input.defaultLocale }),
    },
  });
  return getOrganizationSettings(actor);
}

/* ------------------------------------------------------------------ *
 * Changing the workspace's base currency
 *
 * Every lead in a workspace is stored in that workspace's currency — the
 * invariant `createLeadSchema` describes, and the reason the pipeline totals
 * can be plain `SUM()`s. Changing the currency therefore has to restate the
 * stored amounts, or the invariant breaks and every total on the dashboard
 * silently becomes the sum of two different units.
 *
 * The alternatives were considered and are worse. Relabelling without
 * converting turns 250,000 AED into 250,000 USD. Converting only new leads
 * leaves the two currencies mixed in one column, which is the same broken sum
 * with a longer fuse. So this genuinely rewrites, once, inside a transaction,
 * and the UI shows exactly how many rows and at what rate before it is allowed
 * to happen.
 * ------------------------------------------------------------------ */

async function loadCurrencyContext(actor: Actor, target: Currency) {
  const organization = await prisma.organization.findUnique({
    where: { id: actor.organizationId },
    select: { defaultCurrency: true },
  });
  if (!organization) throw notFound('Workspace');

  const from = organization.defaultCurrency as Currency;
  const { rates, asOf, source } = await getRates();
  if (!rates[from]) {
    // A workspace sitting on a currency the product no longer supports: refuse
    // rather than convert at a rate of one and quietly halve someone's pipeline.
    throw badRequest(`No exchange rate is available for ${from}`);
  }

  return { from, rate: convertCurrency(1, from, target, rates), asOf, source };
}

export async function previewCurrencyChange(
  actor: Actor,
  target: Currency,
): Promise<CurrencyPreviewDto> {
  const { from, rate, asOf, source } = await loadCurrencyContext(actor, target);

  // Scoped to the currency being converted *from*, so "leads affected" is
  // exactly the set the update will touch rather than a superset. Archived
  // leads are included: they are restorable, so leaving them behind would
  // reintroduce the mixed-currency column the conversion exists to avoid.
  const totals = await prisma.lead.aggregate({
    where: { organizationId: actor.organizationId, currency: from },
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });
  const totalBefore = totals._sum.estimatedValue?.toNumber() ?? 0;

  return {
    from,
    to: target,
    rate,
    leads: totals._count._all,
    totalBefore,
    totalAfter: totalBefore * rate,
    asOf,
    source,
  };
}

export async function changeCurrency(
  actor: Actor,
  target: Currency,
): Promise<CurrencyChangeResultDto> {
  const { from, rate } = await loadCurrencyContext(actor, target);
  if (from === target) return { currency: target, converted: 0, rate: 1 };

  const converted = await prisma.$transaction(async (tx) => {
    /*
     * Compare and swap, not read then write.
     *
     * The currency this conversion is *from* was read before the transaction
     * opened. Claiming it here — updating only if the workspace is still in it
     * — is what makes the operation safe to issue twice. Without this, two
     * requests arriving together both read AED, both multiplied, and a lead
     * worth 625,000 AED became 120,148,024 EGP: the rate applied squared, on a
     * write that cannot be undone.
     *
     * A loser sees zero rows matched and changes nothing.
     */
    const claimed = await tx.organization.updateMany({
      where: { id: actor.organizationId, defaultCurrency: from },
      data: { defaultCurrency: target },
    });
    if (claimed.count === 0) return 0;

    // One statement rather than a read-modify-write per lead: the multiplication
    // happens in the database, so a workspace with fifty thousand leads costs
    // the same round-trip as one with five. Scoped by the old currency as well
    // as the tenant, so it can only ever touch rows the claim above covers.
    return tx.$executeRaw`
      UPDATE "leads"
      SET "estimatedValue" = ROUND("estimatedValue" * ${new Prisma.Decimal(rate)}::numeric, 2),
          "currency" = ${target},
          "updatedAt" = "updatedAt"
      WHERE "organizationId" = ${actor.organizationId} AND "currency" = ${from}
    `;
  });

  return { currency: target, converted, rate };
}
