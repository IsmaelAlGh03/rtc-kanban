import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import { requireAuth } from './middleware/auth';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/boards', requireAuth, boardRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

export default app;
