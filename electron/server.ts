import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { jwtVerify } from 'jose';
import { auth, JWT_SECRET, JWT_ISSUER } from './routes/auth';
import { doctorsRouter } from './routes/doctors';
import { pharmaciesRouter } from './routes/pharmacies';
import { productsRouter } from './routes/products';
import { notificationsRouter, checkEventsLogic } from './routes/notifications';
import { intelligentRouter } from './routes/intelligentRouter';
import { statsRouter } from './routes/stats';
import { searchRouter } from './routes/search';
import { excelRouter } from './routes/excel';

export const API_PORT = 3001;

// ── Auth middleware ─────────────────────────────────────────────────────
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: JWT_ISSUER });
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}

// ── Assemble app ────────────────────────────────────────────────────────
export function createServer() {
  const app = new Hono();

  // CORS — allow renderer (localhost:5173) and packaged app
  app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3001', 'file://'],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));

  // Health check (no auth)
  app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

  // Public auth route
  app.route('/api/auth', auth);

  // Protected routes
  const api = new Hono();
  api.use('*', authMiddleware);
  api.route('/doctors', doctorsRouter);
  api.route('/pharmacies', pharmaciesRouter);
  api.route('/products', productsRouter);
  api.route('/notifications', notificationsRouter);
  api.route('/upload/intelligent', intelligentRouter);
  api.route('/stats', statsRouter);
  api.route('/search', searchRouter);
  api.route('/excel', excelRouter);

  app.route('/api', api);

  // 404 fallback
  app.notFound((c) => c.json({ success: false, error: 'Route not found' }, 404));

  return app;
}

// ── Start Node.js HTTP server ───────────────────────────────────────────
export function startServer(): void {
  const app = createServer();
  serve({ fetch: app.fetch, port: API_PORT }, (info) => {
    console.log(`[SuratPharma API] Listening on http://localhost:${info.port}`);
    
    // Background Service: Automated Background Notifications every 60 minutes
    setInterval(() => {
      checkEventsLogic();
    }, 60 * 60 * 1000);

    // Run once on startup
    checkEventsLogic();
  });
}
