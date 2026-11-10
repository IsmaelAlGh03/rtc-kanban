import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import { requireAuth } from './middleware/auth';
import { getDB } from './db';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Unauthenticated liveness check, hit by an external uptime monitor to keep the Render instance warm.
// Always 200 while the process is up so a transient DB blip can't fail the pinger (cron-job.org
// auto-disables jobs after repeated failures). DB state is reported in the body instead.
app.get('/health', async (_req, res) => {
  let dbStatus: 'ok' | 'down' = 'ok';
  try {
    await Promise.race([
      getDB().command({ ping: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 2000).unref()),
    ]);
  } catch {
    dbStatus = 'down';
  }
  res.json({ status: 'ok', db: dbStatus });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', requireAuth, boardRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

export default app;
