import type { AuthorizationContext } from '../lib/authorization';
import type { WebhookContext } from '../middleware/webhook-auth';

export type AppEnv = {
  Variables: {
    auth: AuthorizationContext;
    webhookContext: WebhookContext;
    requestId: string;
  };
};
