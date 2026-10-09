import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'path';
import fs from 'fs';
import { pool, initSchema, ensureAdminFromEnv } from './db';
import { authRouter } from './routes/auth';
import { chatRouter } from './routes/chat';
import { pathRouter } from './routes/path';
import { circleRouter } from './routes/circle';
import { moneyRouter } from './routes/money';
import { moveRouter } from './routes/move';
import { workRouter } from './routes/work';
import { coachRouter } from './routes/coach';

async function main(): Promise<void> {
  await initSchema();
  await ensureAdminFromEnv();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: false, // schema.sql already creates it
      }),
      secret: process.env.SESSION_SECRET || 'heroes-dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    })
  );

  // Health check (no auth)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'heroes-portal', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/path', pathRouter);
  app.use('/api/circle', circleRouter);
  app.use('/api/money', moneyRouter);
  app.use('/api/move', moveRouter);
  app.use('/api/work', workRouter);
  app.use('/api/coach', coachRouter);

  // Static SPA
  const webDistCandidates = [
    path.resolve(process.cwd(), 'web/dist'),
    path.resolve(__dirname, '../../web/dist'),
  ];
  const webDist = webDistCandidates.find((p) => fs.existsSync(p));
  if (webDist) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) { next(); return; }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    console.warn('[boot] web/dist not found - API only mode');
  }

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => {
    console.log(`[boot] heroes-portal listening on :${port}`);
  });
}

main().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
