import express from 'express';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import { requireAuth } from './middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/boards', requireAuth, boardRoutes);

export default app;
