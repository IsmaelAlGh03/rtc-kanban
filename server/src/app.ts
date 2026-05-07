import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import { requireAuth } from './middleware/auth';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/boards', requireAuth, boardRoutes);

export default app;
