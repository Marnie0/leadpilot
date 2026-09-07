import {
  ActivityType,
  FollowUpChannel,
  FollowUpStatus,
  LeadPriority,
  LeadSource,
  PrismaClient,
  type Prisma,
  type StageKey,
} from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { DEFAULT_STAGE_PRESETS } from '../src/lib/stage-presets.js';
import {
  COMPANIES,
  CONTACT_NAMES,
  DEMO_ORG,
  DEMO_PASSWORD,
  DEMO_USERS,
  FOLLOW_UP_TITLES,
  LOST_REASONS,
  NOTE_TEMPLATES,
  SECONDARY_ORG,
  SECONDARY_USERS,
  SERVICES,
  TAG_POOL,
  type SeedUser,
} from './seed-data.js';

// Seeding runs against the unpooled endpoint: it is a long single session doing
// many writes, which is exactly what the pooler is not for.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});

/* ------------------------------------------------------------------ *
 * Deterministic randomness
 *
 * A fixed seed means re-running this produces byte-identical data, so
 * screenshots, demos and any future snapshot tests stay stable.
 * ------------------------------------------------------------------ */

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260907);

const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const pickMany = <T>(items: readonly T[], count: number): T[] => {
  const pool = [...items];
  const chosen: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0] as T);
  }
  return chosen;
};
const intBetween = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (probability: number) => random() < probability;

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

const daysAgo = (days: number, jitterHours = 8): Date =>
  new Date(now.getTime() - days * DAY_MS - intBetween(0, jitterHours) * 60 * 60 * 1000);

const daysAhead = (days: number): Date => {
  const date = new Date(now.getTime() + days * DAY_MS);
  date.setHours(intBetween(9, 17), pick([0, 15, 30, 45]), 0, 0);
  return date;
};

/* ------------------------------------------------------------------ *
 * Shape of the demo pipeline
 *
 * Weighted so the funnel narrows the way a real one does — plenty of new
 * enquiries, far fewer signed deals — and so every stage has enough rows to
 * make the table, filters and (in Phase 2) the board look populated.
 * ------------------------------------------------------------------ */

const STAGE_DISTRIBUTION: Array<{ key: StageKey; count: number; ageRange: [number, number] }> = [
  // Open leads are recent by definition: anything still sitting in New after
  // three months is not a live enquiry, it is a data-quality problem.
  { key: 'NEW', count: 14, ageRange: [0, 9] },
  { key: 'CONTACTED', count: 13, ageRange: [3, 24] },
  { key: 'QUALIFIED', count: 11, ageRange: [8, 40] },
  { key: 'PROPOSAL', count: 8, ageRange: [14, 55] },
  /*
   * Closed deals stretch back a full year, and there are far more of them than
   * of open leads.
   *
   * That ratio is what a real CRM looks like after a year of trading, and the
   * dashboard is the screen that exposes it: with closed deals bunched into the
   * last five months — the original shape — the 12-month trend chart drew seven
   * empty months and then a hockey stick, which reads as "this database was
   * seeded last week" rather than as a working business. Spreading them gives
   * every month a real win rate, a real average deal size and a real cycle time.
   */
  { key: 'WON', count: 28, ageRange: [30, 340] },
  { key: 'LOST', count: 22, ageRange: [35, 350] },
];

const SOURCE_WEIGHTS: Array<[LeadSource, number]> = [
  [LeadSource.WEBSITE, 22],
  [LeadSource.REFERRAL, 18],
  [LeadSource.SOCIAL_MEDIA, 14],
  [LeadSource.PAID_ADS, 12],
  [LeadSource.WALK_IN, 8],
  [LeadSource.EMAIL_CAMPAIGN, 8],
  [LeadSource.PARTNER, 6],
  [LeadSource.EVENT, 5],
  [LeadSource.COLD_CALL, 4],
  [LeadSource.MARKETPLACE, 3],
];

function weightedSource(): LeadSource {
  const total = SOURCE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [source, weight] of SOURCE_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return source;
  }
  return LeadSource.OTHER;
}

const PRIORITY_BY_STAGE: Record<StageKey, LeadPriority[]> = {
  NEW: [LeadPriority.LOW, LeadPriority.MEDIUM, LeadPriority.MEDIUM, LeadPriority.HIGH],
  CONTACTED: [LeadPriority.MEDIUM, LeadPriority.MEDIUM, LeadPriority.HIGH],
  QUALIFIED: [LeadPriority.MEDIUM, LeadPriority.HIGH, LeadPriority.HIGH, LeadPriority.URGENT],
  PROPOSAL: [LeadPriority.HIGH, LeadPriority.HIGH, LeadPriority.URGENT],
  WON: [LeadPriority.MEDIUM, LeadPriority.HIGH],
  LOST: [LeadPriority.LOW, LeadPriority.MEDIUM],
};

function emailFor(name: string, company: string | null): string {
  const handle = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  const domain = company
    ? `${company.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}.com`
    : pick(['gmail.com', 'outlook.com', 'proton.me', 'icloud.com']);
  return `${handle}@${domain}`;
}

function phoneNumber(): string {
  return `+971 5${intBetween(0, 6)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`;
}

function estimatedValueFor(stageKey: StageKey): number {
  // Later-stage leads skew higher: unqualified enquiries include a lot of noise.
  const base = { NEW: 0.6, CONTACTED: 0.8, QUALIFIED: 1.1, PROPOSAL: 1.3, WON: 1.2, LOST: 0.9 }[
    stageKey
  ];
  const raw = (120_000 + random() * 2_400_000) * base;
  return Math.round(raw / 5000) * 5000;
}

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

async function createOrganization(
  definition: { name: string; slug: string; defaultCurrency: string },
  users: SeedUser[],
  passwordHash: string,
  isDemo: boolean,
) {
  const organization = await prisma.organization.create({
    data: {
      name: definition.name,
      slug: definition.slug,
      defaultCurrency: definition.defaultCurrency,
      // The demo workspace is a template: "Start demo" clones it per visitor and
      // nobody signs into it directly, so it stays pristine.
      isDemoTemplate: isDemo,
      isDemo: false,
      stages: {
        create: DEFAULT_STAGE_PRESETS.map((preset) => ({ ...preset })),
      },
      users: {
        create: users.map((user) => ({
          email: user.email,
          name: user.name,
          role: user.role,
          avatarColor: user.avatarColor,
          passwordHash,
          lastLoginAt: daysAgo(intBetween(0, 5)),
        })),
      },
    },
    include: {
      stages: { orderBy: { order: 'asc' } },
      users: { orderBy: { createdAt: 'asc' } },
    },
  });

  return organization;
}

type SeededOrg = Awaited<ReturnType<typeof createOrganization>>;

/**
 * Builds one lead plus a plausible history: the activity entries a rep would
 * have logged on the way to its current stage, and any follow-up still open.
 */
async function createLead(
  org: SeededOrg,
  stageKey: StageKey,
  ageDays: number,
  index: number,
): Promise<void> {
  const stage = org.stages.find((entry) => entry.key === stageKey);
  if (!stage) throw new Error(`Stage ${stageKey} missing for ${org.slug}`);

  const reps = org.users.filter((user) => user.role !== 'OWNER' || org.users.length <= 2);
  const owner = org.users[0];
  if (!owner) throw new Error(`Organisation ${org.slug} has no users`);

  const customerName = CONTACT_NAMES[(index * 7 + stage.order * 13) % CONTACT_NAMES.length] as string;
  const company = COMPANIES[(index * 5 + stage.order * 3) % COMPANIES.length] ?? null;
  const createdAt = daysAgo(ageDays);

  // A small share of new enquiries sit unassigned — that is the realistic state,
  // and it gives the "Unassigned" filter something to find.
  const assignee = stageKey === 'NEW' && chance(0.25) ? null : pick(reps);

  const isWon = stage.type === 'WON';
  const isLost = stage.type === 'LOST';

  /*
   * A closed deal closes a sales cycle after it was created, not at a random
   * point in history. Deriving the close date from the creation date this way is
   * what makes "average days to close" on the dashboard a real figure — picking
   * both dates independently produced cycle times anywhere from a week to ten
   * months on identical-looking deals.
   */
  const salesCycleDays = intBetween(18, 70);
  const closedAt =
    isWon || isLost ? daysAgo(Math.max(1, ageDays - salesCycleDays)) : null;
  const intendedUpdatedAt = closedAt ?? daysAgo(Math.max(0, Math.floor(ageDays / 3)));

  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerName,
      company,
      email: chance(0.92) ? emailFor(customerName, company) : null,
      phone: chance(0.88) ? phoneNumber() : null,
      source: weightedSource(),
      requestedService: pick(SERVICES),
      estimatedValue: estimatedValueFor(stageKey),
      currency: org.defaultCurrency,
      priority: pick(PRIORITY_BY_STAGE[stageKey]),
      description: chance(0.55)
        ? `${customerName.split(' ')[0]} is looking at the ${pick(['Marina', 'Downtown', 'Palm', 'Business Bay', 'JVC', 'Al Barsha'])} area. ${pick(['Cash purchase.', 'Mortgage in progress.', 'Second property.', 'Relocating from abroad.', 'Investment, not owner-occupied.'])}`
        : null,
      tags: pickMany(TAG_POOL, intBetween(0, 3)),
      stageId: stage.id,
      assignedToId: assignee?.id ?? null,
      createdById: pick(org.users).id,
      boardPosition: index,
      createdAt,
      updatedAt: intendedUpdatedAt,
      ...(isWon && { wonAt: closedAt }),
      ...(isLost && { lostAt: closedAt, lostReason: pick(LOST_REASONS) }),
    },
  });

  /* --- Activity history ------------------------------------------- */

  const activities: Prisma.ActivityCreateManyInput[] = [
    {
      organizationId: org.id,
      leadId: lead.id,
      userId: lead.createdById,
      type: ActivityType.LEAD_CREATED,
      metadata: { toStage: 'NEW' },
      occurredAt: createdAt,
      createdAt,
    },
  ];

  // Walk the funnel from NEW up to the lead's current stage, logging the moves
  // and a note or two along the way.
  const path = DEFAULT_STAGE_PRESETS.filter(
    (preset) => preset.order <= stage.order && preset.type === 'OPEN',
  ).map((preset) => preset.key);
  if (stage.type !== 'OPEN') path.push(stage.key);

  // History runs from creation to the close date, or to now for a live lead.
  // Letting a deal won eight months ago keep logging calls up to today would
  // put dead deals at the top of "Last activity" and make the timeline lie.
  const historyEnd = closedAt ?? now;
  let cursor = createdAt.getTime();
  const span = Math.max(1, (historyEnd.getTime() - createdAt.getTime()) / Math.max(path.length, 1));

  let lastContactedAt: Date | null = null;

  for (const [stepIndex, stepKey] of path.entries()) {
    cursor += span * (0.4 + random() * 0.6);
    const occurredAt = new Date(Math.min(cursor, historyEnd.getTime() - 60_000));

    if (stepIndex > 0) {
      activities.push({
        organizationId: org.id,
        leadId: lead.id,
        userId: assignee?.id ?? owner.id,
        type: ActivityType.STAGE_CHANGED,
        metadata: { fromStage: path[stepIndex - 1] as string, toStage: stepKey },
        occurredAt,
        createdAt: occurredAt,
      });
    }

    const templates = NOTE_TEMPLATES[stepKey] ?? [];
    if (templates.length > 0 && (stepIndex === path.length - 1 || chance(0.65))) {
      const noteType = pick([
        ActivityType.NOTE,
        ActivityType.CALL,
        ActivityType.EMAIL,
        ActivityType.WHATSAPP,
        ActivityType.MEETING,
      ]);
      const noteAt = new Date(occurredAt.getTime() + intBetween(1, 6) * 60 * 60 * 1000);
      const clamped = new Date(Math.min(noteAt.getTime(), historyEnd.getTime() - 30_000));
      activities.push({
        organizationId: org.id,
        leadId: lead.id,
        userId: assignee?.id ?? owner.id,
        type: noteType,
        body: pick(templates),
        occurredAt: clamped,
        createdAt: clamped,
      });
      if (noteType !== ActivityType.NOTE) lastContactedAt = clamped;
    }
  }

  await prisma.activity.createMany({ data: activities });

  /* --- Follow-ups -------------------------------------------------- */

  const followUps: Prisma.FollowUpCreateManyInput[] = [];

  // Closed leads keep their history but get no new tasks.
  if (stage.type === 'OPEN') {
    const completedCount = intBetween(0, 2);
    for (let i = 0; i < completedCount; i += 1) {
      const completedAt = daysAgo(intBetween(2, Math.max(3, ageDays)));
      followUps.push({
        organizationId: org.id,
        leadId: lead.id,
        assignedToId: assignee?.id ?? owner.id,
        createdById: owner.id,
        title: pick(FOLLOW_UP_TITLES),
        dueAt: completedAt,
        channel: pick(Object.values(FollowUpChannel)),
        status: FollowUpStatus.COMPLETED,
        completedAt,
        createdAt: new Date(completedAt.getTime() - 3 * DAY_MS),
      });
    }

    // Roughly one in six open leads has slipped — that is what makes the
    // "Overdue" filter and the Phase 4 inbox worth building.
    if (chance(0.82)) {
      const overdue = chance(0.18);
      const dueAt = overdue ? daysAgo(intBetween(1, 9)) : daysAhead(intBetween(0, 16));
      followUps.push({
        organizationId: org.id,
        leadId: lead.id,
        assignedToId: assignee?.id ?? owner.id,
        createdById: owner.id,
        title: pick(FOLLOW_UP_TITLES),
        notes: chance(0.4) ? 'Prefers a call in the afternoon, Gulf time.' : null,
        dueAt,
        channel: pick(Object.values(FollowUpChannel)),
        status: FollowUpStatus.PENDING,
        createdAt: daysAgo(intBetween(1, 6)),
      });
    }
  }

  if (followUps.length > 0) {
    await prisma.followUp.createMany({ data: followUps });
  }

  /* --- Denormalised columns ---------------------------------------- */

  const nextPending = followUps
    .filter((entry) => entry.status === FollowUpStatus.PENDING)
    .map((entry) => entry.dueAt as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const lastActivityAt = activities
    .map((entry) => entry.occurredAt as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      nextFollowUpAt: nextPending ?? null,
      lastActivityAt: lastActivityAt ?? createdAt,
      lastContactedAt,
    },
  });

  /*
   * Restore the intended timestamp.
   *
   * `updatedAt` carries Prisma's `@updatedAt`, so the write above silently
   * stamped it with the seed run time — leaving every demo lead "updated just
   * now", milliseconds apart, which made the Updated column meaningless and the
   * default "Last updated" sort really just reverse insertion order. Raw SQL is
   * the only way to set the column, because the Prisma client always overrides it.
   */
  await prisma.$executeRaw`UPDATE "leads" SET "updatedAt" = ${intendedUpdatedAt} WHERE "id" = ${lead.id}`;
}

async function main(): Promise<void> {
  console.log('› Resetting demo data…');

  // Only the seeded tenants are removed, so a database that also holds real
  // sign-ups is left untouched.
  await prisma.organization.deleteMany({
    where: { slug: { in: [DEMO_ORG.slug, SECONDARY_ORG.slug] } },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  console.log(`› Creating "${DEMO_ORG.name}" with ${DEMO_USERS.length} team members…`);
  const demoOrg = await createOrganization(DEMO_ORG, DEMO_USERS, passwordHash, true);

  let index = 0;
  let total = 0;
  for (const bucket of STAGE_DISTRIBUTION) {
    for (let i = 0; i < bucket.count; i += 1) {
      const ageDays = intBetween(bucket.ageRange[0], bucket.ageRange[1]);
      await createLead(demoOrg, bucket.key, ageDays, index);
      index += 1;
      total += 1;
    }
    console.log(`  • ${bucket.key.padEnd(10)} ${String(bucket.count).padStart(2)} leads`);
  }

  console.log(`› Creating "${SECONDARY_ORG.name}" (isolation check tenant)…`);
  const otherOrg = await createOrganization(
    SECONDARY_ORG,
    SECONDARY_USERS,
    passwordHash,
    false,
  );
  for (let i = 0; i < 6; i += 1) {
    await createLead(otherOrg, pick(['NEW', 'CONTACTED', 'QUALIFIED', 'WON'] as StageKey[]), intBetween(1, 40), i);
  }

  const [leadCount, activityCount, followUpCount] = await Promise.all([
    prisma.lead.count(),
    prisma.activity.count(),
    prisma.followUp.count(),
  ]);

  console.log('\n✔ Seed complete');
  console.log(`  ${leadCount} leads · ${activityCount} activities · ${followUpCount} follow-ups`);
  console.log(`  ${total} leads in the demo workspace`);
  console.log('\n  Sign in with:');
  console.log(`    email    ${DEMO_USERS[0]?.email}`);
  console.log(`    password ${DEMO_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error('✖ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
