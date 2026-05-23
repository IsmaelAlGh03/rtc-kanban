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

router.get('/:username', async (req: AuthRequest, res: Response) => {
  try {
    const user = await getDB()
      .collection('users')
      .findOne(
        { username: req.params.username },
        { projection: { username: 1, displayName: 1, bio: 1, gravatarHash: 1, _id: 0 } }
      );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      username: user.username,
      displayName: user.displayName ?? user.username,
      bio: user.bio ?? '',
      gravatarHash: user.gravatarHash ?? '',
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
