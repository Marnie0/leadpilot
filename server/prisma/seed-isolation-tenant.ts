/**
 * Seeds a second, ordinary workspace — Northwind Consulting — so that
 * cross-tenant isolation can be demonstrated against the demo template.
 *
 * ## Why this is a separate script, and why it refuses to run almost anywhere
 *
 * The main seed used to create this tenant alongside the template, with the
 * same constant password as the demo accounts. The template cannot be signed
 * into, so a committed password is harmless there; this tenant *can*, and the
 * seed was run against production to create the template, which left a real
 * workspace on the live site whose password was in a public repository.
 *
 * So this tenant now lives here, and this file cannot recreate that situation:
 *
 *  1. It only runs with `NODE_ENV=development`. Anything else exits before a
 *     connection is opened.
 *  2. It refuses to touch a database that holds any real workspace. The only
 *     organisations allowed to exist are the demo template, throwaway demo
 *     sandboxes, and a previous copy of this tenant. Production always has
 *     real sign-ups, so this check fails there regardless of what the
 *     environment variables say.
 *  3. When `PROD_DATABASE_URL` is present it refuses to run against that host,
 *     whatever the other variables claim.
 *  4. The password is generated on each run and printed once. Nothing in the
 *     repository can sign into the result.
 *
 * Each guard would be enough on its own. They are all here because the failure
 * this prevents is the one where somebody is sure they are pointed at the
 * right database.
 */
import { randomBytes } from 'node:crypto';
import type { StageKey } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { SECONDARY_ORG, SECONDARY_USERS } from './seed-data.js';
import { createLead, createOrganization, intBetween, pick, prisma } from './seed-builders.js';

class RefusedError extends Error {}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace('-pooler.', '.');
  } catch {
    return null;
  }
}

/** Every guard that can be checked without opening a connection. */
function refuseUnlessDevelopment(): void {
  if (process.env.NODE_ENV !== 'development') {
    throw new RefusedError(
      `NODE_ENV is "${process.env.NODE_ENV ?? ''}". This tenant is only ever created in development.`,
    );
  }
  const target = hostOf(
    process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  );
  const production = hostOf(process.env.PROD_DATABASE_URL);
  if (target && production && target === production) {
    throw new RefusedError('The target database is the production database.');
  }
}

/** The guard that holds even when the environment lies: real workspaces exist. */
async function refuseIfRealWorkspacesExist(): Promise<void> {
  const real = await prisma.organization.findMany({
    where: {
      isDemoTemplate: false,
      isDemo: false,
      slug: { not: SECONDARY_ORG.slug },
    },
    select: { slug: true },
    take: 5,
  });
  if (real.length > 0) {
    throw new RefusedError(
      `This database holds real workspaces (${real.map((o) => o.slug).join(', ')}${
        real.length === 5 ? ', …' : ''
      }). The isolation tenant is never created beside real data.`,
    );
  }
}

async function main(): Promise<void> {
  refuseUnlessDevelopment();
  await refuseIfRealWorkspacesExist();

  console.log(`› Replacing "${SECONDARY_ORG.name}"…`);
  await prisma.organization.deleteMany({ where: { slug: SECONDARY_ORG.slug } });

  const password = randomBytes(12).toString('base64url');
  const organization = await createOrganization(
    SECONDARY_ORG,
    SECONDARY_USERS,
    await hashPassword(password),
    false,
  );
  for (let i = 0; i < 6; i += 1) {
    await createLead(
      organization,
      pick(['NEW', 'CONTACTED', 'QUALIFIED', 'WON'] as StageKey[]),
      intBetween(1, 40),
      i,
    );
  }

  console.log(`\n✔ "${SECONDARY_ORG.name}" created with ${SECONDARY_USERS.length} accounts`);
  console.log('  Sign in with either account and this password (shown once, not stored anywhere):');
  for (const user of SECONDARY_USERS) console.log(`    ${user.email}`);
  console.log(`    password  ${password}\n`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof RefusedError) {
      console.error(`✖ Refused: ${error.message}`);
    } else {
      console.error('✖ Seed failed:', error);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
