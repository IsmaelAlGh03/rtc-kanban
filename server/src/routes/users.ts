import { Router, Response } from 'express';
import { getDB } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 1) return res.json([]);

    const regex = new RegExp(`^${q}`, 'i');
    const users = await getDB()
      .collection('users')
      .find({ $or: [{ username: regex }, { email: regex }], username: { $ne: req.username } })
      .limit(10)
      .project({ username: 1, _id: 0 })
      .toArray();

    res.json(users.map((u: any) => u.username));
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
