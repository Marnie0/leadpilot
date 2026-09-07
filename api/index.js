/**
 * Vercel serverless entrypoint.
 *
 * Every `/api/*` request is rewritten to this single function (see vercel.json),
 * which hands it to the same Express app that `npm run dev` runs locally — an
 * Express app *is* a `(req, res)` handler, so no adapter is needed.
 *
 * This file imports the tsup-built bundle rather than TypeScript source, so the
 * function build never has to resolve the workspace's TS paths.
 */
import { createApp } from '../server/dist/app.js';

const app = createApp();

export default app;
