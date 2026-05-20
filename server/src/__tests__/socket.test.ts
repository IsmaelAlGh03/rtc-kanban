import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { connectDB, getDB } from '../db';
import { registerSocketHandlers } from '../socket/handlers';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { ObjectId } from 'mongodb';
import app from '../app';

jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendMentionEmail: jest.fn().mockResolvedValue(undefined),
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  initNotificationService: jest.fn(),
}));

let mongod: MongoMemoryServer;
let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;

function makeToken(username: string) {
  return jwt.sign({ username }, JWT_SECRET);
}

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise(resolve => socket.once(event, resolve));
}

async function seedBoard(owner: string, members: string[] = []) {
  const colId = new ObjectId().toString();
  const result = await getDB().collection('boards').insertOne({
    title: 'Test Board',
    owner,
    members,
    pendingInvites: [],
    columns: [
      { _id: colId, title: 'To Do', order: 0, cards: [] },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { boardId: result.insertedId.toString(), colId };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());

  httpServer = createServer(app);
  io = new Server(httpServer, { cors: { origin: '*' } });
  registerSocketHandlers(io);

  await new Promise<void>(resolve => httpServer.listen(0, resolve));
  port = (httpServer.address() as any).port;
});

afterAll(async () => {
  io.close();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await mongod.stop();
});

afterEach(async () => {
  await getDB().collection('boards').deleteMany({});
  await getDB().collection('users').deleteMany({});
});

describe('Socket authentication', () => {
  test('rejects connection without token', done => {
    const socket = ioc(`http://localhost:${port}`, {
      auth: {},
      transports: ['websocket'],
    });
    socket.on('connect_error', err => {
      expect(err.message).toMatch(/authentication/i);
      socket.disconnect();
      done();
    });
    socket.on('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected'));
    });
  });

  test('rejects connection with invalid token', done => {
    const socket = ioc(`http://localhost:${port}`, {
      auth: { token: 'not-a-valid-jwt' },
      transports: ['websocket'],
    });
    socket.on('connect_error', err => {
      expect(err.message).toMatch(/invalid|expired/i);
      socket.disconnect();
      done();
    });
    socket.on('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected'));
    });
  });

  test('connects successfully with valid token', async () => {
    const socket = await connect(makeToken('alice'));
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});

describe('board:join access control', () => {
  test('emits board:updated on successful join', async () => {
    const { boardId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('board:join', boardId);
    const board = await boardUpdatedP;

    expect(board._id.toString()).toBe(boardId);
    socket.disconnect();
  });

  test('emits board:error when joining a board without access', async () => {
    const { boardId } = await seedBoard('alice');
    const socket = await connect(makeToken('bob'));

    const errP = waitForEvent<string>(socket, 'board:error');
    socket.emit('board:join', boardId);
    const err = await errP;

    expect(err).toMatch(/access denied/i);
    socket.disconnect();
  });

  test('member can join board', async () => {
    const { boardId } = await seedBoard('alice', ['bob']);
    const socket = await connect(makeToken('bob'));

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('board:join', boardId);
    const board = await boardUpdatedP;

    expect(board.members).toContain('bob');
    socket.disconnect();
  });
});

describe('card:add', () => {
  test('adds a card and broadcasts board:updated', async () => {
    const { boardId, colId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('card:add', { boardId, columnId: colId, title: 'New Card' });
    const board = await boardUpdatedP;

    const col = board.columns.find((c: any) => c._id === colId);
    expect(col.cards).toHaveLength(1);
    expect(col.cards[0].title).toBe('New Card');
    expect(col.cards[0].addedBy).toBe('alice');
    socket.disconnect();
  });

  test('emits board:error when not in the room', async () => {
    const { boardId, colId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    const errP = waitForEvent<string>(socket, 'board:error');
    socket.emit('card:add', { boardId, columnId: colId, title: 'Sneaky Card' });
    const err = await errP;

    expect(err).toMatch(/access denied/i);
    socket.disconnect();
  });
});

describe('card:move', () => {
  test('moves a card between columns', async () => {
    const col1Id = new ObjectId().toString();
    const col2Id = new ObjectId().toString();
    const cardId = new ObjectId().toString();

    const result = await getDB().collection('boards').insertOne({
      title: 'Board',
      owner: 'alice',
      members: [],
      pendingInvites: [],
      columns: [
        { _id: col1Id, title: 'To Do', order: 0, cards: [{ _id: cardId, title: 'Card', order: 0, addedBy: 'alice', urgency: 'low', comments: [] }] },
        { _id: col2Id, title: 'Done', order: 1, cards: [] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const boardId = result.insertedId.toString();

    const socket = await connect(makeToken('alice'));
    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('card:move', { boardId, cardId, fromColumnId: col1Id, toColumnId: col2Id, toIndex: 0 });
    const board = await boardUpdatedP;

    const col1 = board.columns.find((c: any) => c._id === col1Id);
    const col2 = board.columns.find((c: any) => c._id === col2Id);
    expect(col1.cards).toHaveLength(0);
    expect(col2.cards).toHaveLength(1);
    expect(col2.cards[0]._id).toBe(cardId);
    socket.disconnect();
  });
});

describe('card:delete', () => {
  test('deletes a card and broadcasts update', async () => {
    const colId = new ObjectId().toString();
    const cardId = new ObjectId().toString();

    const result = await getDB().collection('boards').insertOne({
      title: 'Board',
      owner: 'alice',
      members: [],
      pendingInvites: [],
      columns: [
        { _id: colId, title: 'To Do', order: 0, cards: [{ _id: cardId, title: 'Delete Me', order: 0, addedBy: 'alice', urgency: 'low', comments: [] }] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const boardId = result.insertedId.toString();

    const socket = await connect(makeToken('alice'));
    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('card:delete', { boardId, columnId: colId, cardId });
    const board = await boardUpdatedP;

    const col = board.columns.find((c: any) => c._id === colId);
    expect(col.cards).toHaveLength(0);
    socket.disconnect();
  });
});

describe('card:update', () => {
  test('updates card fields and broadcasts', async () => {
    const colId = new ObjectId().toString();
    const cardId = new ObjectId().toString();

    const result = await getDB().collection('boards').insertOne({
      title: 'Board',
      owner: 'alice',
      members: [],
      pendingInvites: [],
      columns: [
        { _id: colId, title: 'To Do', order: 0, cards: [{ _id: cardId, title: 'Old Title', order: 0, addedBy: 'alice', urgency: 'low', comments: [] }] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const boardId = result.insertedId.toString();

    const socket = await connect(makeToken('alice'));
    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('card:update', { boardId, columnId: colId, cardId, urgency: 'high' });
    const board = await boardUpdatedP;

    const card = board.columns[0].cards.find((c: any) => c._id === cardId);
    expect(card.urgency).toBe('high');
    socket.disconnect();
  });
});

describe('card:comment:add', () => {
  test('appends a comment and broadcasts', async () => {
    const colId = new ObjectId().toString();
    const cardId = new ObjectId().toString();

    const result = await getDB().collection('boards').insertOne({
      title: 'Board',
      owner: 'alice',
      members: [],
      pendingInvites: [],
      columns: [
        { _id: colId, title: 'To Do', order: 0, cards: [{ _id: cardId, title: 'Card', order: 0, addedBy: 'alice', urgency: 'low', comments: [] }] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const boardId = result.insertedId.toString();

    const socket = await connect(makeToken('alice'));
    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('card:comment:add', { boardId, columnId: colId, cardId, text: 'Great card!', mentions: [] });
    const board = await boardUpdatedP;

    const card = board.columns[0].cards.find((c: any) => c._id === cardId);
    expect(card.comments).toHaveLength(1);
    expect(card.comments[0].text).toBe('Great card!');
    expect(card.comments[0].username).toBe('alice');
    socket.disconnect();
  });
});

describe('column:add', () => {
  test('adds a column and broadcasts', async () => {
    const { boardId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('column:add', { boardId, title: 'Review' });
    const board = await boardUpdatedP;

    expect(board.columns).toHaveLength(2);
    expect(board.columns[1].title).toBe('Review');
    socket.disconnect();
  });
});

describe('column:delete', () => {
  test('deletes a column and broadcasts', async () => {
    const { boardId, colId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('column:delete', { boardId, columnId: colId });
    const board = await boardUpdatedP;

    expect(board.columns).toHaveLength(0);
    socket.disconnect();
  });
});

describe('column:update', () => {
  test('renames a column and broadcasts', async () => {
    const { boardId, colId } = await seedBoard('alice');
    const socket = await connect(makeToken('alice'));

    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('column:update', { boardId, columnId: colId, title: 'Renamed' });
    const board = await boardUpdatedP;

    expect(board.columns[0].title).toBe('Renamed');
    socket.disconnect();
  });
});

describe('column:move', () => {
  test('reorders columns and broadcasts', async () => {
    const col1Id = new ObjectId().toString();
    const col2Id = new ObjectId().toString();

    const result = await getDB().collection('boards').insertOne({
      title: 'Board',
      owner: 'alice',
      members: [],
      pendingInvites: [],
      columns: [
        { _id: col1Id, title: 'First', order: 0, cards: [] },
        { _id: col2Id, title: 'Second', order: 1, cards: [] },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const boardId = result.insertedId.toString();

    const socket = await connect(makeToken('alice'));
    await new Promise<void>(resolve => {
      socket.emit('board:join', boardId);
      socket.once('board:updated', () => resolve());
    });

    const boardUpdatedP = waitForEvent<any>(socket, 'board:updated');
    socket.emit('column:move', { boardId, columnId: col1Id, toIndex: 1 });
    const board = await boardUpdatedP;

    expect(board.columns[0]._id).toBe(col2Id);
    expect(board.columns[1]._id).toBe(col1Id);
    socket.disconnect();
  });
});
