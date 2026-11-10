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
import * as db from '../db';
import { connectDB } from '../db';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
});

afterAll(async () => {
  await mongod.stop();
});

describe('GET /health', () => {
  it('returns 200 ok without auth', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('still returns 200 when the DB ping fails, reporting db: down', async () => {
    const spy = jest.spyOn(db, 'getDB').mockReturnValue({
      command: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as ReturnType<typeof db.getDB>);
    try {
      const res = await request(app).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', db: 'down' });
    } finally {
      spy.mockRestore();
    }
  });
});
