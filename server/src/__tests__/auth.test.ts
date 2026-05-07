import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDB } from '../db';
import app from '../app';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
});

afterAll(async () => {
  await mongod.stop();
});

const baseUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password1!',
};

describe('POST /api/auth/register', () => {
  test('rejects registration without an email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'nomail', password: 'pass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('rejects registration with an invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'badmail', email: 'not-an-email', password: 'pass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'shortpass', email: 'short@example.com', password: 'Ab1!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('rejects password with no uppercase letter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'noupperpass', email: 'noupper@example.com', password: 'password1!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('rejects password with no number', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'nonumpass', email: 'nonum@example.com', password: 'Password!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('rejects password with no special character', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'nospecialpass', email: 'nospecial@example.com', password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('registers successfully with valid username, email, and password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(baseUser);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe(baseUser.username);
  });

  test('rejects registration with a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'otheruser', email: baseUser.email, password: 'Password1!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
  });

  test('rejects registration with a duplicate username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: baseUser.username, email: 'other@example.com', password: 'Password1!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/username/i);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with username and correct password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: baseUser.username, password: baseUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('logs in with email and correct password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: baseUser.email, password: baseUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: baseUser.username, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('rejects login with unknown identifier', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'ghost@nobody.com', password: 'pass123' });

    expect(res.status).toBe(401);
  });
});
