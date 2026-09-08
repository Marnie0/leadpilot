import { Router } from 'express';
import {
  changeCurrencySchema,
  currencyPreviewSchema,
  updateOrganizationSchema,
  type ChangeCurrencyInput,
  type CurrencyPreviewInput,
  type UpdateOrganizationInput,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as settingsService from './settings.service.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    permissions: auth.permissions,
    isOwner: auth.isOwner,
  };
};

/**
 * Readable by every member: the settings screen shows the workspace name and
 * currency to everyone, and only puts the form controls in front of a manager.
 * A rep who cannot see the currency cannot understand the figures they are
 * looking at.
 */
settingsRouter.get(
  '/organization',
  asyncHandler(async (req, res) => {
    res.json({ organization: await settingsService.getOrganizationSettings(actorFrom(req)) });
  }),
);

settingsRouter.get(
  '/events',
  asyncHandler(async (req, res) => {
    res.json({ events: await settingsService.listWorkspaceEvents(actorFrom(req)) });
  }),
);

settingsRouter.patch(
  '/organization',
  requirePermission('MANAGE_WORKSPACE'),
  validate(updateOrganizationSchema),
  asyncHandler(async (req, res) => {
    const organization = await settingsService.updateOrganization(
      actorFrom(req),
      req.body as UpdateOrganizationInput,
    );
    res.json({ organization });
  }),
);

/*
 * Changing the base currency restates every stored amount in the workspace, so
 * it is the owner's call alone — an admin manages leads and people, not the
 * unit the business reports in. The preview is gated the same way rather than
 * more loosely: it is the sentence the confirmation is built from.
 */
settingsRouter.get(
  '/currency/preview',
  requirePermission('CHANGE_CURRENCY'),
  validate(currencyPreviewSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { currency } = validatedQuery<CurrencyPreviewInput>(req);
    res.json({ preview: await settingsService.previewCurrencyChange(actorFrom(req), currency) });
  }),
);

settingsRouter.post(
  '/currency',
  requirePermission('CHANGE_CURRENCY'),
  validate(changeCurrencySchema),
  asyncHandler(async (req, res) => {
    const { currency } = req.body as ChangeCurrencyInput;
    res.json({ result: await settingsService.changeCurrency(actorFrom(req), currency) });
  }),
);
