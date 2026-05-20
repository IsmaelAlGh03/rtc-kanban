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

import { sendConfirmationEmail, sendPasswordResetEmail } from '../services/email';
const mockSendConfirmation = sendConfirmationEmail as jest.Mock;
const mockSendPasswordReset = sendPasswordResetEmail as jest.Mock;

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

describe('GET /api/auth/verify-email', () => {
  test('returns 400 when token is missing', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });

  test('returns 400 for unknown token', async () => {
    const res = await request(app).get('/api/auth/verify-email?token=doesnotexist');
    expect(res.status).toBe(400);
  });

  test('returns 400 for expired token', async () => {
    await getDB().collection('users').updateOne(
      { username: baseUser.username },
      { $set: { emailVerificationExpires: new Date(Date.now() - 1000) } }
    );
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    const res = await request(app).get(`/api/auth/verify-email?token=${user!.emailVerificationToken}`);
    expect(res.status).toBe(400);
    // restore expiry for subsequent tests
    await getDB().collection('users').updateOne(
      { username: baseUser.username },
      { $set: { emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
    );
  });

  test('verifies email with valid token', async () => {
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    const res = await request(app).get(`/api/auth/verify-email?token=${user!.emailVerificationToken}`);
    expect(res.status).toBe(200);
    const updated = await getDB().collection('users').findOne({ username: baseUser.username });
    expect(updated!.emailVerified).toBe(true);
    expect(updated!.emailVerificationToken).toBeUndefined();
  });
});

describe('POST /api/auth/resend-verification', () => {
  let unverifiedToken: string;

  beforeAll(async () => {
    // register a fresh unverified user
    mockSendConfirmation.mockClear();
    const reg = await request(app).post('/api/auth/register').send({
      username: 'resenduser',
      email: 'resend@example.com',
      password: 'Password1!',
    });
    unverifiedToken = reg.body.token;
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/auth/resend-verification');
    expect(res.status).toBe(401);
  });

  test('returns 400 if email is already verified', async () => {
    // use baseUser whose email was verified above
    const loginRes = await request(app).post('/api/auth/login').send({ identifier: baseUser.username, password: baseUser.password });
    const verifiedToken = loginRes.body.token;
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${verifiedToken}`);
    expect(res.status).toBe(400);
  });

  test('sends new verification email for unverified user', async () => {
    mockSendConfirmation.mockClear();
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${unverifiedToken}`);
    expect(res.status).toBe(200);
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
  });

  test('stores a new token after resend', async () => {
    const before = await getDB().collection('users').findOne({ username: 'resenduser' });
    await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${unverifiedToken}`);
    const after = await getDB().collection('users').findOne({ username: 'resenduser' });
    expect(after!.emailVerificationToken).toBeDefined();
    expect(after!.emailVerificationToken).not.toBe(before!.emailVerificationToken);
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => mockSendPasswordReset.mockClear());

  test('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'notanemail' });
    expect(res.status).toBe(400);
  });

  test('returns 200 for unknown email without sending email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(mockSendPasswordReset).not.toHaveBeenCalled();
  });

  test('returns 200 and sends reset email for known email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: baseUser.email });
    expect(res.status).toBe(200);
    expect(mockSendPasswordReset).toHaveBeenCalledTimes(1);
    expect(mockSendPasswordReset).toHaveBeenCalledWith(baseUser.email, baseUser.username, expect.any(String));
  });

  test('stores reset token in DB for known email', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: baseUser.email });
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    expect(user!.passwordResetToken).toBeDefined();
    expect(user!.passwordResetExpires).toBeDefined();
  });
});

describe('POST /api/auth/reset-password', () => {
  let resetToken: string;

  beforeAll(async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: baseUser.email });
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    resetToken = user!.passwordResetToken;
  });

  test('returns 400 when token is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ password: 'NewPass1!' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken });
    expect(res.status).toBe(400);
  });

  test('returns 400 for unknown token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'badtoken', password: 'NewPass1!' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for expired token', async () => {
    await getDB().collection('users').updateOne(
      { username: baseUser.username },
      { $set: { passwordResetExpires: new Date(Date.now() - 1000) } }
    );
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: 'NewPass1!' });
    expect(res.status).toBe(400);
    await getDB().collection('users').updateOne(
      { username: baseUser.username },
      { $set: { passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) } }
    );
  });

  test('returns 400 for weak new password', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  test('resets password and clears token with valid request', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'NewPass1!' });
    expect(res.status).toBe(200);
    const user = await getDB().collection('users').findOne({ username: baseUser.username });
    expect(user!.passwordResetToken).toBeUndefined();
    expect(user!.passwordResetExpires).toBeUndefined();
  });

  test('can log in with new password after reset', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: baseUser.username, password: 'NewPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
