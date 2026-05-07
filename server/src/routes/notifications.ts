import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { AuthRequest } from '../middleware/auth';
import { INotification, createNotification } from '../services/notifications';
import { IBoard } from '../models/Board';

const router = Router();

function notifs() {
  return getDB().collection<INotification>('notifications');
}

function boards() {
  return getDB().collection<IBoard>('boards');
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const all = await notifs()
      .find({ userId: req.username! })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(all);
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/read', async (req: AuthRequest, res: Response) => {
  try {
    await notifs().updateMany({ userId: req.username!, read: false }, { $set: { read: true } });
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.post('/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const notif = await notifs().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.username!) return res.status(403).json({ error: 'Access denied' });
    if (notif.type !== 'invite') return res.status(400).json({ error: 'Not an invite' });

    const board = await boards().findOne({ _id: new ObjectId(notif.boardId) as any });
    if (!board) return res.status(404).json({ error: 'Board no longer exists' });

    await boards().updateOne(
      { _id: new ObjectId(notif.boardId) as any },
      {
        $addToSet: { members: req.username! },
        $pull: { pendingInvites: req.username! },
      }
    );

    await notifs().updateOne({ _id: notif._id as any }, { $set: { read: true } });

    await createNotification({
      userId: notif.fromUsername,
      type: 'invite_accepted',
      boardId: notif.boardId,
      boardTitle: notif.boardTitle,
      fromUsername: req.username!,
    });

    res.json({ message: 'Invite accepted' });
  } catch {
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const notif = await notifs().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId !== req.username!) return res.status(403).json({ error: 'Access denied' });
    if (notif.type !== 'invite') return res.status(400).json({ error: 'Not an invite' });

    await boards().updateOne(
      { _id: new ObjectId(notif.boardId) as any },
      { $pull: { pendingInvites: req.username! } }
    );

    await notifs().updateOne({ _id: notif._id as any }, { $set: { read: true } });

    await createNotification({
      userId: notif.fromUsername,
      type: 'invite_rejected',
      boardId: notif.boardId,
      boardTitle: notif.boardTitle,
      fromUsername: req.username!,
    });

    res.json({ message: 'Invite rejected' });
  } catch {
    res.status(500).json({ error: 'Failed to reject invite' });
  }
});

export default router;
