import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { prettyJSON } from 'hono/pretty-json';
import { pinoLogger } from './middleware/pino-logger';
import { rateLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import { healthRoutes } from './routes/health';
import { orgRoutes } from './routes/organizations';
import { airportRoutes } from './routes/airports';
import { airlineRoutes } from './routes/airlines';
import { flightRoutes } from './routes/flights';
import { baggageRoutes } from './routes/baggage';
import { baggageEventRoutes } from './routes/baggage-events';
import { caseRoutes } from './routes/cases';
import { taskRoutes } from './routes/tasks';
import { auditRoutes } from './routes/audit';
import { notificationRoutes } from './routes/notifications';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/uploads';
import { roleRoutes } from './routes/roles';
import { userManagementRoutes } from './routes/users';
import { invitationRoutes } from './routes/invitations';
import { serviceIdentityRoutes } from './routes/service-identities';
import { integrationRoutes, webhookRoutes } from './routes/integrations';
import { baggageDetailRoutes } from './routes/baggage-detail';
import { operationalEventRoutes } from './routes/operational-events';
import { journeyRoutes } from './routes/journeys';
import { expectedEventRoutes } from './routes/expected-events';
import { exceptionRoutes } from './routes/exceptions';
import { custodyRoutes } from './routes/custody';
import { slaRoutes } from './routes/sla';
import { escalationRoutes } from './routes/escalations';
import { workflowRoutes } from './routes/workflows';
import { recoveryPlanRoutes } from './routes/recovery-plans';
import { recoveryProviderRoutes } from './routes/recovery-providers';
import { analyticsRoutes } from './routes/analytics';
import { commandCenterRoutes } from './routes/command-center';
import { alertsRoutes } from './routes/alerts';
import { savedViewsRoutes } from './routes/analytics-saved-views';
import { exportsRoutes } from './routes/analytics-exports';
import { intelligenceRoutes } from './routes/intelligence';
import { env } from './lib/env';
import { serve } from '@hono/node-server';
import type { AppEnv } from './types/env';

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
