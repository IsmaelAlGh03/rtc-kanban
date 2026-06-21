import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendMentionEmail: jest.fn().mockResolvedValue(undefined),
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

import app from '../app';
import { connectDB, getDB } from '../db';
import { createNotification } from '../services/notifications';
import { cleanupExpiredGuests } from '../services/guestCleanup';
import { sendAssignmentEmail } from '../services/email';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
});

afterAll(async () => {
  await mongod.stop();
});

describe('guest mode', () => {
  it('creates a guest account, a seeded board, and an authenticated session', async () => {
    const res = await request(app).post('/api/auth/guest').expect(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.username).toMatch(/^guest-[0-9a-f]+$/);
    const { token, username } = res.body;

    // /me reports guest + verified
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.guest).toBe(true);
    expect(me.body.emailVerified).toBe(true);

    // a starter board was seeded and is owned by the guest
    const boards = await request(app).get('/api/boards').set('Authorization', `Bearer ${token}`).expect(200);
    expect(boards.body).toHaveLength(1);
    expect(boards.body[0].owner).toBe(username);
    expect(boards.body[0].columns).toHaveLength(3);

    // guest cannot generate share/invite links
    const boardId = boards.body[0]._id;
    await request(app).post(`/api/boards/${boardId}/invite`).set('Authorization', `Bearer ${token}`).expect(403);
    await request(app)
      .patch(`/api/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'someone' })
      .expect(403);
  });

  it('does not send notification emails to guest recipients', async () => {
    (sendAssignmentEmail as jest.Mock).mockClear();
    const guest = await getDB().collection('users').findOne({ guest: true });

    await createNotification({
      userId: guest!.username,
      type: 'assigned',
      boardId: 'b1',
      boardTitle: 'Demo',
      fromUsername: 'someone',
      cardId: 'c1',
      cardTitle: 'A card',
      columnId: 'col1',
    });

    expect(sendAssignmentEmail).not.toHaveBeenCalled();
  });

  it('cleanup removes guests older than the TTL and their boards', async () => {
    const guest = await getDB().collection('users').findOne({ guest: true });
    const username = guest!.username;
    // Backdate the guest beyond the TTL.
    await getDB()
      .collection('users')
      .updateOne({ username }, { $set: { createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } });

    const removed = await cleanupExpiredGuests();
    expect(removed).toBeGreaterThanOrEqual(1);

    expect(await getDB().collection('users').findOne({ username })).toBeNull();
    expect(await getDB().collection('boards').findOne({ owner: username })).toBeNull();
  });
});
