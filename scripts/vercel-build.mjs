/**
 * The Vercel build, with the migration step gated to production.
 *
 * `prisma migrate deploy` runs here rather than after the deploy so that a
 * migration which cannot apply fails the build and nothing ships — see the
 * README. But "on every build" once meant preview builds too, and a preview
 * build runs against whatever database the Preview environment points at. For
 * a while that was a copy of the production connection string, which would
 * have let a pull-request branch carrying a migration migrate production. So:
 * the schema is only ever applied from a production build. Preview builds
 * compile without a database and never touch one.
 */
import { spawnSync } from 'node:child_process';

const SCHEMA = 'server/prisma/schema.prisma';
const environment = process.env.VERCEL_ENV ?? 'local';

function run(label, command, args) {
  console.log(`\n› ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`✖ ${label} failed (exit ${result.status ?? 'signal'})`);
    process.exit(result.status ?? 1);
  }
}

run('Generating the Prisma client', 'npx', ['prisma', 'generate', '--schema', SCHEMA]);

if (environment === 'production') {
  run('Applying pending migrations (production build)', 'npx', [
    'prisma',
    'migrate',
    'deploy',
    '--schema',
    SCHEMA,
  ]);
} else {
  console.log(`\n› Skipping migrations: VERCEL_ENV is "${environment}", not "production"`);
}

run('Building the API', 'npm', ['run', 'build', '--workspace', '@leadpilot/server']);
run('Building the web client', 'npm', ['run', 'build', '--workspace', '@leadpilot/client']);
