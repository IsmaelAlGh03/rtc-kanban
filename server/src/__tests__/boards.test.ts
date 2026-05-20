import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDB, getDB } from '../db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendMentionEmail: jest.fn().mockResolvedValue(undefined),
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

import app from '../app';

let mongod: MongoMemoryServer;

function makeToken(username: string) {
  return jwt.sign({ username }, JWT_SECRET);
}

async function createUser(username: string, email: string) {
  await getDB().collection('users').insertOne({ username, email, passwordHash: 'x', emailVerified: true });
}

async function createBoard(owner: string, members: string[] = []) {
  const { ObjectId } = await import('mongodb');
  const result = await getDB().collection('boards').insertOne({
    title: 'Test Board',
    owner,
    members,
    pendingInvites: [],
    columns: [
      { _id: new ObjectId().toString(), title: 'To Do', order: 0, cards: [] },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.insertedId.toString();
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
});

afterAll(async () => {
  await mongod.stop();
});

afterEach(async () => {
  await getDB().collection('boards').deleteMany({});
  await getDB().collection('users').deleteMany({});
  await getDB().collection('notifications').deleteMany({});
});

describe('Board access control', () => {
  test('GET /api/boards returns only boards the user owns or is member of', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    await createBoard('alice');
    await createBoard('bob');
    await createBoard('bob', ['alice']);

    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((b: any) => b.owner === 'alice' || b.members.includes('alice'))).toBe(true);
  });

  test('GET /api/boards/:id returns 403 for non-member', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob');

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(403);
  });

  test('GET /api/boards/:id returns board for owner', async () => {
    await createUser('alice', 'alice@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);
    expect(res.body.owner).toBe('alice');
  });

  test('GET /api/boards/:id returns board for member', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob', ['alice']);

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);
  });

  test('PATCH /api/boards/:id returns 403 for member (not owner)', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob', ['alice']);

    const res = await request(app)
      .patch(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });

  test('DELETE /api/boards/:id returns 403 for member (not owner)', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob', ['alice']);

    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(403);
  });

  test('DELETE /api/boards/:id succeeds for owner', async () => {
    await createUser('alice', 'alice@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/boards');
    expect(res.status).toBe(401);
  });
});

describe('Board sharing / invite', () => {
  test('POST /:id/invite generates an invite token (owner only)', async () => {
    await createUser('alice', 'alice@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .post(`/api/boards/${boardId}/invite`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /:id/invite returns 403 for non-owner', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob', ['alice']);

    const res = await request(app)
      .post(`/api/boards/${boardId}/invite`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(403);
  });

  test('GET /join/:token adds user to board', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('alice');

    const inviteRes = await request(app)
      .post(`/api/boards/${boardId}/invite`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    const token = inviteRes.body.token;

    const joinRes = await request(app)
      .get(`/api/boards/join/${token}`)
      .set('Authorization', `Bearer ${makeToken('bob')}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.members).toContain('bob');
  });

  test('PATCH /:id/members sends invite notification to existing user', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .patch(`/api/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${makeToken('alice')}`)
      .send({ username: 'bob' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('bob');
    expect(res.body.pending).toBe(true);
  });

  test('PATCH /:id/members returns 404 for unknown user', async () => {
    await createUser('alice', 'alice@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .patch(`/api/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${makeToken('alice')}`)
      .send({ username: 'ghost' });

    expect(res.status).toBe(404);
  });

  test('DELETE /:id/members/:username removes member', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('alice', ['bob']);

    const res = await request(app)
      .delete(`/api/boards/${boardId}/members/bob`)
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);

    const board = await getDB().collection('boards').findOne({ members: 'bob' });
    expect(board).toBeNull();
  });
});

describe('Account deletion', () => {
  test('deletes the user and their boardless boards', async () => {
    await createUser('alice', 'alice@test.com');
    const boardId = await createBoard('alice');

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    expect(res.status).toBe(200);

    const user = await getDB().collection('users').findOne({ username: 'alice' });
    expect(user).toBeNull();

    const { ObjectId } = await import('mongodb');
    const board = await getDB().collection('boards').findOne({ _id: new ObjectId(boardId) as any });
    expect(board).toBeNull();
  });

  test('transfers owned board to first member instead of deleting it', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('alice', ['bob']);

    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    const { ObjectId } = await import('mongodb');
    const board = await getDB().collection('boards').findOne({ _id: new ObjectId(boardId) as any });
    expect(board).not.toBeNull();
    expect(board!.owner).toBe('bob');
    expect(board!.members).not.toContain('bob');
  });

  test('removes user from other boards they were a member of', async () => {
    await createUser('alice', 'alice@test.com');
    await createUser('bob', 'bob@test.com');
    const boardId = await createBoard('bob', ['alice']);

    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${makeToken('alice')}`);

    const { ObjectId } = await import('mongodb');
    const board = await getDB().collection('boards').findOne({ _id: new ObjectId(boardId) as any });
    expect(board!.members).not.toContain('alice');
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/auth/account');
    expect(res.status).toBe(401);
  });
});
