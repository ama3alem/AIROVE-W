import type { AuthorizationContext } from '../lib/authorization.js';
import type { WebhookContext } from '../middleware/webhook-auth.js';

export type AppEnv = {
  Variables: {
    auth: AuthorizationContext;
    webhookContext: WebhookContext;
    requestId: string;
  };
};
