import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { prettyJSON } from 'hono/pretty-json';
import { pinoLogger } from './middleware/pino-logger.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { orgRoutes } from './routes/organizations.js';
import { airportRoutes } from './routes/airports.js';
import { airlineRoutes } from './routes/airlines.js';
import { flightRoutes } from './routes/flights.js';
import { baggageRoutes } from './routes/baggage.js';
import { baggageEventRoutes } from './routes/baggage-events.js';
import { caseRoutes } from './routes/cases.js';
import { taskRoutes } from './routes/tasks.js';
import { auditRoutes } from './routes/audit.js';
import { notificationRoutes } from './routes/notifications.js';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/uploads.js';
import { roleRoutes } from './routes/roles.js';
import { userManagementRoutes } from './routes/users.js';
import { invitationRoutes } from './routes/invitations.js';
import { serviceIdentityRoutes } from './routes/service-identities.js';
import { integrationRoutes, webhookRoutes } from './routes/integrations.js';
import { baggageDetailRoutes } from './routes/baggage-detail.js';
import { operationalEventRoutes } from './routes/operational-events.js';
import { journeyRoutes } from './routes/journeys.js';
import { expectedEventRoutes } from './routes/expected-events.js';
import { exceptionRoutes } from './routes/exceptions.js';
import { custodyRoutes } from './routes/custody.js';
import { slaRoutes } from './routes/sla.js';
import { escalationRoutes } from './routes/escalations.js';
import { workflowRoutes } from './routes/workflows.js';
import { recoveryPlanRoutes } from './routes/recovery-plans.js';
import { recoveryProviderRoutes } from './routes/recovery-providers.js';
import { analyticsRoutes } from './routes/analytics.js';
import { commandCenterRoutes } from './routes/command-center.js';
import { alertsRoutes } from './routes/alerts.js';
import { savedViewsRoutes } from './routes/analytics-saved-views.js';
import { exportsRoutes } from './routes/analytics-exports.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { env } from './lib/env.js';
import { serve } from '@hono/node-server';
import type { AppEnv } from './types/env.js';

const app = new Hono<AppEnv>();

app.onError(errorHandler);
app.use('*', requestId());
app.use('*', logger());
app.use('*', pinoLogger());
app.use('*', cors({
  origin: env.CORS_ORIGINS().split(','),
  credentials: true,
}));
app.use('*', prettyJSON());

const apiRoutes = app.basePath('/api');

apiRoutes.route('/health', healthRoutes);
apiRoutes.route('/auth', authRoutes);
apiRoutes.route('/organizations', orgRoutes);
apiRoutes.route('/airports', airportRoutes);
apiRoutes.route('/airlines', airlineRoutes);
apiRoutes.route('/flights', flightRoutes);
apiRoutes.route('/baggage', baggageRoutes);
apiRoutes.route('/baggage-events', baggageEventRoutes);
apiRoutes.route('/audit', auditRoutes);
apiRoutes.route('/notifications', notificationRoutes);
apiRoutes.route('/uploads', uploadRoutes);

// Layer 2: Identity, Organizations & Access
apiRoutes.route('/roles', roleRoutes);
apiRoutes.route('/users', userManagementRoutes);
apiRoutes.route('/invitations', invitationRoutes);
apiRoutes.route('/service-identities', serviceIdentityRoutes);

// Layer 3: Integration & Data Normalization
apiRoutes.route('/integrations', integrationRoutes);
apiRoutes.route('/integrations', webhookRoutes);

// Layer 4: Operations & Event Engine
apiRoutes.route('/baggage', baggageDetailRoutes);
apiRoutes.route('/operational-events', operationalEventRoutes);
apiRoutes.route('/journeys', journeyRoutes);
apiRoutes.route('/expected-events', expectedEventRoutes);
apiRoutes.route('/exceptions', exceptionRoutes);
apiRoutes.route('/custody', custodyRoutes);

// Layer 5: Case & Workflow Engine
apiRoutes.route('/cases', caseRoutes);
apiRoutes.route('/tasks', taskRoutes);
apiRoutes.route('/sla', slaRoutes);
apiRoutes.route('/escalations', escalationRoutes);
apiRoutes.route('/workflows', workflowRoutes);

// Layer 6: Recovery & Routing Engine
apiRoutes.route('/recovery-plans', recoveryPlanRoutes);
apiRoutes.route('/recovery-providers', recoveryProviderRoutes);

// Layer 7: Analytics & Command Center
apiRoutes.route('/analytics', analyticsRoutes);
apiRoutes.route('/command-center', commandCenterRoutes);
apiRoutes.route('/analytics/alerts', alertsRoutes);
apiRoutes.route('/analytics/saved-views', savedViewsRoutes);
apiRoutes.route('/analytics/exports', exportsRoutes);

// Layer 8A: AI Intelligence Engine
apiRoutes.route('/intelligence', intelligenceRoutes);

const port = env.API_PORT();

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`[AIROVE API] Running on http://localhost:${info.port}`);
});

export type AppType = typeof app;
