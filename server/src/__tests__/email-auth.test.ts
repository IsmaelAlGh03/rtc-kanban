import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDB, getDB } from '../db';
import app from '../app';

jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendMentionEmail: jest.fn().mockResolvedValue(undefined),
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

import { sendConfirmationEmail } from '../services/email';
const mockSendConfirmation = sendConfirmationEmail as jest.Mock;

let mongod: MongoMemoryServer;
let token: string;

const baseUser = { username: 'emailuser', email: 'email@example.com', password: 'Password1!' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
});

afterAll(async () => {
  await mongod.stop();
});

describe('POST /api/auth/register (email)', () => {
  beforeAll(async () => {
    mockSendConfirmation.mockClear();
    await request(app).post('/api/auth/register').send(baseUser);
  });

  test('creates user with emailVerified: false', async () => {
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    expect(user?.emailVerified).toBe(false);
    expect(user?.emailVerificationToken).toBeDefined();
  });

  test('sends confirmation email on register', async () => {
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmation).toHaveBeenCalledWith(
      baseUser.email,
      baseUser.username,
      expect.any(String)
    );
  });
});

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: baseUser.username, password: baseUser.password });
    token = res.body.token;
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns username and emailVerified', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(baseUser.username);
    expect(res.body.emailVerified).toBe(false);
  });
});
