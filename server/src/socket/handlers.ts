import { Server, Socket } from 'socket.io';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { getDB } from '../db';
import { IBoard } from '../models/Board';
import { JWT_SECRET } from '../config';

function boards() {
  return getDB().collection<IBoard>('boards');
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { username: string };
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('board:join', (boardId: string) => {
      socket.join(boardId);
      console.log(`${socket.id} joined board ${boardId}`);
    });

    socket.on(
      'card:move',
      async (payload: {
        boardId: string;
        cardId: string;
        fromColumnId: string;
        toColumnId: string;
        toIndex: number;
      }) => {
        const { boardId, cardId, fromColumnId, toColumnId, toIndex } = payload;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const fromCol = board.columns.find((c) => c._id === fromColumnId);
          const toCol = board.columns.find((c) => c._id === toColumnId);
          if (!fromCol || !toCol) return;

          const cardIndex = fromCol.cards.findIndex((c) => c._id === cardId);
          if (cardIndex === -1) return;

          const [card] = fromCol.cards.splice(cardIndex, 1);
          toCol.cards.splice(toIndex, 0, card);

          fromCol.cards.forEach((c, i) => (c.order = i));
          toCol.cards.forEach((c, i) => (c.order = i));

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('card:move error', err);
        }
      }
    );

    socket.on(
      'card:add',
      async (payload: { boardId: string; columnId: string; title: string }) => {
        const { boardId, columnId, title } = payload;
        const addedBy = socket.data.username as string;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const col = board.columns.find((c) => c._id === columnId);
          if (!col) return;

          col.cards.push({
            _id: new ObjectId().toString(),
            title,
            order: col.cards.length,
            addedBy,
            urgency: 'low',
            comments: [],
          });

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('card:add error', err);
        }
      }
    );

    socket.on(
      'card:delete',
      async (payload: { boardId: string; columnId: string; cardId: string }) => {
        const { boardId, columnId, cardId } = payload;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const col = board.columns.find((c) => c._id === columnId);
          if (!col) return;

          col.cards = col.cards.filter((c) => c._id !== cardId);
          col.cards.forEach((c, i) => (c.order = i));

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('card:delete error', err);
        }
      }
    );

    socket.on('column:add', async (payload: { boardId: string; title: string }) => {
      const { boardId, title } = payload;
      try {
        const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
        if (!board) return;

        board.columns.push({
          _id: new ObjectId().toString(),
          title,
          order: board.columns.length,
          cards: [],
        });

        const now = new Date();
        await boards().updateOne(
          { _id: new ObjectId(boardId) as any },
          { $set: { columns: board.columns, updatedAt: now } }
        );
        board.updatedAt = now;

        io.to(boardId).emit('board:updated', board);
      } catch (err) {
        console.error('column:add error', err);
      }
    });

    socket.on('column:delete', async (payload: { boardId: string; columnId: string }) => {
      const { boardId, columnId } = payload;
      try {
        const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
        if (!board) return;

        board.columns = board.columns.filter((c) => c._id !== columnId);
        board.columns.forEach((c, i) => (c.order = i));

        const now = new Date();
        await boards().updateOne(
          { _id: new ObjectId(boardId) as any },
          { $set: { columns: board.columns, updatedAt: now } }
        );
        board.updatedAt = now;

        io.to(boardId).emit('board:updated', board);
      } catch (err) {
        console.error('column:delete error', err);
      }
    });

    socket.on(
      'card:update',
      async (payload: {
        boardId: string;
        columnId: string;
        cardId: string;
        title?: string;
        description?: string;
        assignedTo?: string;
        urgency?: 'low' | 'medium' | 'high';
      }) => {
        const { boardId, columnId, cardId, title, description, assignedTo, urgency } = payload;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const col = board.columns.find((c) => c._id === columnId);
          if (!col) return;

          const card = col.cards.find((c) => c._id === cardId);
          if (!card) return;

          if (title !== undefined) card.title = title;
          if (description !== undefined) card.description = description;
          if (assignedTo !== undefined) card.assignedTo = assignedTo;
          if (urgency !== undefined) card.urgency = urgency;

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('card:update error', err);
        }
      }
    );

    socket.on(
      'card:comment:add',
      async (payload: { boardId: string; columnId: string; cardId: string; text: string }) => {
        const { boardId, columnId, cardId, text } = payload;
        const username = socket.data.username as string;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const col = board.columns.find((c) => c._id === columnId);
          if (!col) return;

          const card = col.cards.find((c) => c._id === cardId);
          if (!card) return;

          card.comments.push({
            _id: new ObjectId().toString(),
            username,
            text,
            timestamp: new Date(),
          });

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('card:comment:add error', err);
        }
      }
    );

    socket.on(
      'column:update',
      async (payload: { boardId: string; columnId: string; title: string }) => {
        const { boardId, columnId, title } = payload;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const col = board.columns.find((c) => c._id === columnId);
          if (!col) return;

          col.title = title;

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('column:update error', err);
        }
      }
    );

    socket.on(
      'column:move',
      async (payload: { boardId: string; columnId: string; toIndex: number }) => {
        const { boardId, columnId, toIndex } = payload;
        try {
          const board = await boards().findOne({ _id: new ObjectId(boardId) as any });
          if (!board) return;

          const colIndex = board.columns.findIndex((c) => c._id === columnId);
          if (colIndex === -1) return;

          const [col] = board.columns.splice(colIndex, 1);
          board.columns.splice(toIndex, 0, col);
          board.columns.forEach((c, i) => (c.order = i));

          const now = new Date();
          await boards().updateOne(
            { _id: new ObjectId(boardId) as any },
            { $set: { columns: board.columns, updatedAt: now } }
          );
          board.updatedAt = now;

          io.to(boardId).emit('board:updated', board);
        } catch (err) {
          console.error('column:move error', err);
        }
      }
    );

    socket.on(
      'chat:message',
      (payload: { boardId: string; text: string }) => {
        const { boardId, text } = payload;
        io.to(boardId).emit('chat:message', {
          username: socket.data.username as string,
          text,
          timestamp: new Date().toISOString(),
        });
      }
    );

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
