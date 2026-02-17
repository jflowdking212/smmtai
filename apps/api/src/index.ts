import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: config.frontend.url, credentials: true }));
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);

// Error handling
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 EE PostMind API running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export default app;
