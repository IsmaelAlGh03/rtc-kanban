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
app.get('/health', async (_req, res) => {
  try {
    await getDB().command({ ping: 1 });
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', requireAuth, boardRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

export default app;
