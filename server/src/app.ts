import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './env.js';
import { logger } from './logger.js';
import { apiRouter } from './routes.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { forbidden } from './lib/errors.js';


/** Hostnames that always count as "this machine" during development. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** RFC1918 ranges, so a phone on the same Wi-Fi can reach the dev server. */
const PRIVATE_IPV4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * Decides whether a browser Origin may send credentialed requests.
 *
 * Production is strict: only what CORS_ORIGINS lists. Development additionally
 * accepts any loopback or private-LAN address on any port, because the exact
 * origin is not knowable in advance — Vite moves to 5174 when 5173 is taken,
 * `127.0.0.1` and `localhost` are different origins to a browser, and testing
 * the responsive layout on a phone uses the machine's LAN IP.
 */
export function isOriginAllowed(origin: string, requestHost?: string | undefined): boolean {
  if (env.corsOrigins.includes(origin)) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    // Not a parseable URL, so not an origin we can vouch for.
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  /*
   * Same-origin always allowed.
   *
   * Browsers send `Origin` on same-origin POST/PATCH/DELETE, so the deployed
   * SPA's own login request arrives carrying one. An allowlist cannot cover it:
   * on Vercel every preview deployment gets its own hostname, so the only stable
   * rule is "the Origin matches the host this request was addressed to".
   */
  if (requestHost && parsed.host === requestHost) return true;

  if (env.isProduction) return false;

  return LOOPBACK_HOSTNAMES.has(parsed.hostname) || PRIVATE_IPV4.test(parsed.hostname);
}

/**
 * Builds the Express application.
 *
 * Exported as a factory rather than a module-level singleton so the same app can
 * be listened on by `src/index.ts` locally, handed to a serverless function on
 * Vercel, or mounted inside a test — no host-specific code in the app itself.
 */
export function createApp(): Express {
  const app = express();

  // Behind Vercel's and Render's proxies, so `req.ip` and `secure` reflect the
  // original client rather than the load balancer.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /**
   * First middleware in the stack, deliberately: every response — including one
   * rejected by CORS before any other middleware runs — must carry an id that
   * ties it to a line in the log.
   */
  app.use((req, res, next) => {
    req.id = req.get('x-request-id') ?? randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(
    helmet({
      // The API returns JSON only; the SPA is served as static files by the host
      // CDN, so a restrictive default CSP here would not apply to it anyway.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  /**
   * In production the client is same-origin, so no CORS headers are needed at
   * all. In development the Vite dev server proxies `/api`, and this allowlist
   * covers anyone calling the API directly. `credentials: true` is what lets the
   * auth cookie ride along.
   */
  // The delegate form is used so the check can see the request host, which the
  // plain `origin(origin, cb)` callback is not given.
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      // Behind Vercel's proxy the original host arrives as x-forwarded-host.
      const forwarded = req.headers['x-forwarded-host'];
      const host =
        (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host ?? undefined;

      // No Origin header at all: curl, server-to-server, same-origin navigation.
      if (!origin || isOriginAllowed(origin, host)) {
        callback(null, {
          origin: true,
          credentials: true,
          methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        });
        return;
      }

      // Rejecting with a typed AppError makes this a 403 naming the offending
      // origin. Passing a bare Error here (as this once did) lands in the error
      // handler's catch-all and reports a blank 500, indistinguishable from a
      // genuine server fault.
      callback(
        forbidden(
          `Origin ${origin} is not allowed by CORS. Add it to CORS_ORIGINS in your .env.`,
        ),
      );
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id ?? randomUUID(),
      // Health checks would otherwise dominate the log at info level.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
