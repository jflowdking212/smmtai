import express from 'express';
import { scheduleTrialChecker } from './jobs/scheduler.js';
import { TrendCollectorService } from './services/trends/trend-collector.service.js';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { resolve } from 'path';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import { csrfProtection } from './middleware/csrf.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { workspaceRouter } from './routes/workspace.js';
import { billingRouter } from './routes/billing.js';
import { connectionRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';
import { postRouter } from './routes/posts.js';
import { scheduleRouter } from './routes/schedule.js';
import { analyticsRouter } from './routes/analytics.js';
import { templateRouter } from './routes/templates.js';
import { feedbackRouter } from './routes/feedback.js';
import { adminRouter } from './routes/admin.js';
import { chatRouter } from './routes/chat.js';
import { bgRemoveRouter } from './routes/bgRemove.js';
import { collaborationRouter } from './routes/collaboration.js';
import { facebookRouter } from './routes/facebook.js';
import { messagingRouter } from './routes/messaging.js';
import { trendsRouter } from './routes/trends.js';
import { contentPlannerRouter } from './routes/content-planner.js';
import {
  scheduleAnalyticsIngestion,
  scheduleAnalyticsDigestReports,
  scheduleConnectionHealthMonitoring,
  scheduleMediaRetentionCleanup,
} from './jobs/scheduler.js';

// Initialize Sentry
if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    tracesSampleRate: config.isDev ? 1.0 : 0.2,
    profilesSampleRate: config.isDev ? 1.0 : 0.1,
  });
}

const app = express();
app.set('trust proxy', 1);

// Stripe webhook needs raw body — must be before express.json()
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

// Security & parsing
app.use(helmet());
app.use(hpp());
app.use(cors({ origin: config.frontend.url, credentials: true }));
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(resolve(process.env.MEDIA_UPLOAD_DIR || 'uploads')));
app.use(sanitizeRequest);
app.use(csrfProtection);
app.use('/api/v1', (req, res, next) => {
  // Skip global rate limiter for admin routes (protected by auth + owner role)
  if (req.path.startsWith('/admin')) return next();
  return apiLimiter(req, res, next);
});

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/workspaces', workspaceRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/connections', connectionRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1/schedule', scheduleRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/templates', templateRouter);
app.use('/api/v1/feedback', feedbackRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/bg-remove', bgRemoveRouter);
app.use('/api/v1/collaboration', collaborationRouter);
app.use('/api/v1/facebook', facebookRouter);
app.use('/api/v1/messaging', messagingRouter);
app.use('/api/v1/trends', trendsRouter);
app.use('/api/v1/content-planner', contentPlannerRouter);

// Sentry error handler (must be before custom errorHandler)
if (config.sentry.dsn) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handling
app.use(errorHandler);

app.listen(config.port, () => {
scheduleTrialChecker();

  // ── Trend Collection: run on startup + every 2 hours ──
  void (async () => {
    try {
      console.log('   📊 Running initial trend collection...');
      const count = await TrendCollectorService.collectAllTrends();
      console.log(`   📊 Initial trend collection done: ${count} trends saved`);
    } catch (e: any) {
      console.error('   Failed initial trend collection:', e.message);
    }
  })();
  setInterval(async () => {
    try {
      console.log('[TrendScheduler] Collecting trends...');
      await TrendCollectorService.purgeOldTrends();
      const count = await TrendCollectorService.collectAllTrends();
      console.log(`[TrendScheduler] Done: ${count} trends saved`);
    } catch (e: any) {
      console.error('[TrendScheduler] Error:', e.message);
    }
  }, 30 * 60 * 1000); // Every 30 minutes

  console.log(`🚀 SmmtAI API running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  void scheduleAnalyticsIngestion()
    .then(({ intervalMs }) => {
      console.log(`   Analytics ingestion scheduled every ${Math.round(intervalMs / 60000)} minutes`);
    })
    .catch((error) => {
      console.error('   Failed to schedule analytics ingestion:', error instanceof Error ? error.message : error);
    });
  void scheduleAnalyticsDigestReports()
    .then(({ timezone, weeklyPattern, monthlyPattern }) => {
      console.log(`   Analytics digest reports scheduled (${timezone}) weekly=${weeklyPattern} monthly=${monthlyPattern}`);
    })
    .catch((error) => {
      console.error('   Failed to schedule analytics digest reports:', error instanceof Error ? error.message : error);
    });
  void scheduleConnectionHealthMonitoring()
    .then(({ intervalMs }) => {
      console.log(`   Connection health monitoring scheduled every ${Math.round(intervalMs / 60000)} minutes`);
    })
    .catch((error) => {
      console.error('   Failed to schedule connection health monitoring:', error instanceof Error ? error.message : error);
    });
  void scheduleMediaRetentionCleanup()
    .then(({ intervalMs }) => {
      console.log(`   Media retention cleanup scheduled every ${Math.round(intervalMs / 3600000)} hours`);
    })
    .catch((error) => {
      console.error('   Failed to schedule media retention cleanup:', error instanceof Error ? error.message : error);
    });
});

export default app;
