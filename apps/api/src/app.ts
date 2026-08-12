import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getAuth, requireAuth } from './http/auth.js';
import { authRouter } from './modules/auth/routes.js';
import { evidenceRouter } from './modules/evidence/routes.js';
import { organizationRouter } from './modules/organizations/routes.js';
import { projectRouter } from './modules/projects/routes.js';
import { taskRouter } from './modules/tasks/routes.js';
import { prisma } from './platform/db.js';
import { env } from './platform/env.js';
import { ZodError } from 'zod';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health/live', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'proofflow-api',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health/ready', async (_request, response) => {
    const databaseConfigured = Boolean(env.DATABASE_URL);
    if (!databaseConfigured) {
      const ready = env.NODE_ENV !== 'production';
      response.status(ready ? 200 : 503).json({
        status: ready ? 'ok' : 'degraded',
        service: 'proofflow-api',
        dependencies: { database: 'not-configured' },
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      response.json({
        status: 'ok',
        service: 'proofflow-api',
        dependencies: { database: 'connected' },
        timestamp: new Date().toISOString()
      });
    } catch {
      response.status(503).json({
        status: 'degraded',
        service: 'proofflow-api',
        dependencies: { database: 'unavailable' },
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/v1', (_request, response) => {
    response.json({
      name: 'ProofFlow API',
      version: 'v1',
      status: 'scaffold'
    });
  });

  app.use('/v1/auth', authRouter);
  app.use('/v1/organizations', organizationRouter);
  app.get('/v1/organizations', requireAuth, async (request, response) => {
    const auth = getAuth(request);
    const memberships = auth ? await prisma.organizationMember.findMany({
      where: { userId: auth.userId },
      select: { organizationId: true, role: true, organization: { select: { id: true, name: true, slug: true } } }
    }) : [];
    response.json({ organizations: memberships });
  });
  app.use('/v1/projects', projectRouter);
  app.use('/v1', taskRouter);
  app.use('/v1', evidenceRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.'
      }
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request contains invalid fields.',
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
        }
      });
      return;
    }
    console.error(JSON.stringify({ level: 'error', service: 'proofflow-api', message: 'Unhandled request error' }));
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } });
  });

  return { app, port: env.PORT };
}
