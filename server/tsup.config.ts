import { defineConfig } from 'tsup';

/**
 * Bundles the API (and the source-only @leadpilot/shared workspace package)
 * into a single ESM file so the server can be deployed to any Node host —
 * Vercel, Render, Fly or a plain VPS — without shipping node_modules.
 */
export default defineConfig({
  // Two entries: `index` boots a long-running HTTP server, `app` exports the
  // Express instance for the Vercel serverless function to wrap.
  entry: ['src/index.ts', 'src/app.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Prisma resolves its query engine relative to the generated client on disk,
  // so it must stay external rather than being inlined into the bundle.
  external: ['@prisma/client', '.prisma/client'],
  noExternal: ['@leadpilot/shared'],
});
