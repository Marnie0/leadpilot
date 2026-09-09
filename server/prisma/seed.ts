/**
 * Seeds the demo template: Meridian Property Group, 96 leads, a year of history.
 *
 * This is the one seed that runs against production, once, so the demo button
 * has something to clone. It creates the template and nothing else. It used to
 * also create a second ordinary workspace with a password committed to this
 * repository, and production was seeded with it; that tenant now lives in
 * `seed-isolation-tenant.ts`, which cannot run against a database that holds
 * real workspaces. The delete below removes the old tenant wherever it is
 * still found, so re-running this seed anywhere purges the leftover rather
 * than preserving it.
 */
import { hashPassword } from '../src/lib/password.js';
import { DEMO_ORG, DEMO_PASSWORD, DEMO_USERS, SECONDARY_ORG } from './seed-data.js';
import {
  STAGE_DISTRIBUTION,
  createLead,
  createOrganization,
  intBetween,
  prisma,
} from './seed-builders.js';

async function main(): Promise<void> {
  console.log('› Resetting demo data…');

  // Only the seeded tenants are removed, so a database that also holds real
  // sign-ups is left untouched. The isolation tenant is included so that a
  // copy created by an older version of this script is purged, not kept.
  await prisma.organization.deleteMany({
    where: { slug: { in: [DEMO_ORG.slug, SECONDARY_ORG.slug] } },
  });

  // The template's accounts cannot sign in anywhere (`isDemoTemplate` is
  // refused at login); the hash exists so that per-visitor clones can be
  // signed into by the browser harness.
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

  const [leadCount, activityCount, followUpCount] = await Promise.all([
    prisma.lead.count({ where: { organizationId: demoOrg.id } }),
    prisma.activity.count({ where: { organizationId: demoOrg.id } }),
    prisma.followUp.count({ where: { organizationId: demoOrg.id } }),
  ]);

  console.log('\n✔ Seed complete');
  console.log(`  ${leadCount} leads · ${activityCount} activities · ${followUpCount} follow-ups`);
  console.log(`  ${total} leads in the demo template`);
  console.log('\n  Nobody signs into the template. Open the app and click "Start a demo".');
  console.log('  For a stable second workspace in development: npm run db:seed:isolation\n');
}

main()
  .catch((error) => {
    console.error('✖ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
