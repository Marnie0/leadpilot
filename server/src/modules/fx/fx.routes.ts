import { Router } from 'express';
import { asyncHandler, requireAuth } from '../../middleware/auth.js';
import { getRates } from './fx.service.js';

export const fxRouter = Router();

/**
 * Behind auth even though exchange rates are public information: an open
 * endpoint here is a free proxy to somebody else's API, quoted against our
 * rate limit rather than the caller's.
 */
fxRouter.use(requireAuth);

fxRouter.get(
  '/rates',
  asyncHandler(async (_req, res) => {
    const rates = await getRates();
    // Rates move once a day; letting the browser and any CDN hold them for an
    // hour keeps the switcher instant without ever being more than that stale.
    res.set('Cache-Control', 'private, max-age=3600');
    res.json(rates);
  }),
);
