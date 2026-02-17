import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { workspaceRouter } from './routes/workspace.js';
import { billingRouter } from './routes/billing.js';
import { connectionRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';

const app = express();

// Stripe webhook needs raw body — must be before express.json()
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

// Security & parsing
app.use(helmet());
app.use(cors({ origin: config.frontend.url, credentials: true }));
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/v1', apiLimiter);

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/workspaces', workspaceRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/connections', connectionRouter);
app.use('/api/v1/ai', aiRouter);

// Error handling
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 EE PostMind API running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export default app;
