import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getDB } from '../db';
import { IBoard } from '../models/Board';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from '../services/notifications';
import { sanitize } from '../utils/sanitize';

const router = Router();

function boards() {
  return getDB().collection<IBoard>('boards');
}

function isOwner(board: IBoard, username: string) {
  return board.owner === username;
}

function hasAccess(board: IBoard, username: string) {
  return board.owner === username || board.members.includes(username);
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username!;
    const all = await boards().find({
      $or: [{ owner: username }, { members: username }],
    }).toArray();
    res.json(all);
  } catch {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

router.get('/join/:token', async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username!;
    const board = await boards().findOne({ inviteToken: req.params.token });
    if (!board) return res.status(404).json({ error: 'Invalid or expired invite link' });
    if (hasAccess(board, username)) return res.json(board);

    await boards().updateOne(
      { _id: board._id as any },
      { $addToSet: { members: username } }
    );
    res.json({ ...board, members: [...board.members, username] });
  } catch {
    res.status(500).json({ error: 'Failed to join board' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!hasAccess(board, req.username!)) return res.status(403).json({ error: 'Access denied' });
    res.json(board);
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username!;
    const now = new Date();
    const board: IBoard = {
      title: sanitize(req.body.title || 'My Board'),
      ...(req.body.description && { description: sanitize(req.body.description) }),
      ...(req.body.color && { color: req.body.color }),
      owner: username,
      members: [],
      pendingInvites: [],
      columns: [
        { _id: new ObjectId().toString(), title: 'To Do', order: 0, cards: [] },
        { _id: new ObjectId().toString(), title: 'In Progress', order: 1, cards: [] },
        { _id: new ObjectId().toString(), title: 'Done', order: 2, cards: [] },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const result = await boards().insertOne(board as any);
    res.status(201).json({ ...board, _id: result.insertedId });
  } catch {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!isOwner(board, req.username!)) return res.status(403).json({ error: 'Only the owner can edit this board' });

    const { title, description, color } = req.body;
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });

    const update: Record<string, unknown> = { title: sanitize(title.trim()), updatedAt: new Date() };
    if (typeof description === 'string') update.description = sanitize(description.trim());
    if (typeof color === 'string') update.color = color;

    await boards().updateOne({ _id: board._id as any }, { $set: update });
    res.json({ message: 'Board updated' });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!isOwner(board, req.username!)) return res.status(403).json({ error: 'Only the owner can delete this board' });

    await boards().deleteOne({ _id: board._id as any });
    res.json({ message: 'Board deleted' });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!isOwner(board, req.username!)) return res.status(403).json({ error: 'Only the owner can manage sharing' });

    const token = crypto.randomBytes(16).toString('hex');
    await boards().updateOne({ _id: board._id as any }, { $set: { inviteToken: token } });
    res.json({ token });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.patch('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!isOwner(board, req.username!)) return res.status(403).json({ error: 'Only the owner can manage sharing' });

    const { username } = req.body;
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'username is required' });
    if (username === board.owner) return res.status(400).json({ error: 'Owner is already on this board' });

    const user = await getDB().collection('users').findOne({
      $or: [{ username }, { email: username.toLowerCase() }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const actualUsername = user.username as string;
    if (board.members.includes(actualUsername)) return res.status(409).json({ error: 'User already has access' });
    if ((board.pendingInvites ?? []).includes(actualUsername)) return res.status(409).json({ error: 'Invite already sent' });

    await boards().updateOne({ _id: board._id as any }, { $addToSet: { pendingInvites: actualUsername } });

    await createNotification({
      userId: actualUsername,
      type: 'invite',
      boardId: board._id!.toString(),
      boardTitle: board.title,
      fromUsername: req.username!,
    });

    res.json({ username: actualUsername, pending: true });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.delete('/:id/members/:username', async (req: AuthRequest, res: Response) => {
  try {
    const board = await boards().findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!isOwner(board, req.username!)) return res.status(403).json({ error: 'Only the owner can manage sharing' });

    await boards().updateOne({ _id: board._id as any }, { $pull: { members: req.params.username } });
    res.json({ message: 'Member removed' });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

export default router;
