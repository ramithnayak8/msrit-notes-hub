import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose, { isValidObjectId } from 'mongoose';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { notFound } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { llmProviders } from './llm/provider.js';
import { EMBEDDING_MODEL } from './ml/embedder.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { JobModel } from './models/Job.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { questionsRouter, reviewRouter } from './routes/review.js';
import { searchRouter } from './routes/search.js';
import { topicsRouter } from './routes/topics.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render/Railway's proxy, so rate limits see the real client IP

  // Order matters: security headers and CORS first, then body parsing, then logging, then routes.
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' }, customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug') }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: mongoose.connection.readyState === 1,
      db: mongoose.connection.name,
      embeddingModel: EMBEDDING_MODEL,
      llm: llmProviders(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/questions', questionsRouter);
  app.use('/api/topics', topicsRouter);
  app.use('/api/review', reviewRouter);
  app.use('/api/analytics', analyticsRouter);

  app.get('/api/jobs/:id', async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw notFound('Job');
    const job = await JobModel.findById(req.params.id).select('-outputs').lean();
    if (!job) throw notFound('Job');
    res.json({ job });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
