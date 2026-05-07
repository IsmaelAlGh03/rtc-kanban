import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { IBoard } from '../models/Board';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const boards = await getDB().collection<IBoard>('boards').find().toArray();
    res.json(boards);
  }catch{
    res.status(500).json({ error: 'Failed to fetch boards' })
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const board = await getDB()
      .collection<IBoard>('boards')
      .findOne({ _id: new ObjectId(req.params.id as string) as any });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    res.json(board);
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const board: IBoard = {
      title: req.body.title || 'My Board',
      columns: [
        { _id: new ObjectId().toString(), title: 'To Do', order: 0, cards: [] },
        { _id: new ObjectId().toString(), title: 'In Progress', order: 1, cards: [] },
        { _id: new ObjectId().toString(), title: 'Done', order: 2, cards: [] },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const result = await getDB().collection<IBoard>('boards').insertOne(board as any);
    res.status(201).json({ ...board, _id: result.insertedId });
  } catch {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await getDB()
      .collection('boards')
      .deleteOne({ _id: new ObjectId(req.params.id as string) as any });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Board not found' });
    res.json({ message: 'Board deleted' });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const result = await getDB()
      .collection('boards')
      .updateOne(
        { _id: new ObjectId(req.params.id as string) as any },
        { $set: { title: title.trim(), updatedAt: new Date() } }
      );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Board not found' });
    res.json({ message: 'Board updated' });
  } catch {
    res.status(400).json({ error: 'Invalid board ID' });
  }
});



export default router;
