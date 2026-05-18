import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, getDB } from '../db';
import { createNotification } from '../services/notifications';

jest.mock('../services/email', () => ({
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
  sendMentionEmail: jest.fn().mockResolvedValue(undefined),
}));

import { sendInviteEmail, sendAssignmentEmail, sendMentionEmail } from '../services/email';
const mockSendInvite = sendInviteEmail as jest.Mock;
const mockSendAssignment = sendAssignmentEmail as jest.Mock;
const mockSendMention = sendMentionEmail as jest.Mock;

let mongod: MongoMemoryServer;

const base = {
  boardId: 'board1',
  boardTitle: 'My Board',
  fromUsername: 'alice',
  cardId: 'card1',
  cardTitle: 'Do the thing',
  columnId: 'col1',
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
  await getDB().collection('users').insertOne({
    username: 'bob',
    email: 'bob@example.com',
    passwordHash: 'x',
    emailVerified: true,
  });
});

afterAll(async () => {
  await mongod.stop();
});

beforeEach(() => {
  mockSendInvite.mockClear();
  mockSendAssignment.mockClear();
  mockSendMention.mockClear();
});

describe('createNotification — email side effects', () => {
  test('sends invite email for type "invite"', async () => {
    await createNotification({ ...base, userId: 'bob', type: 'invite' });
    expect(mockSendInvite).toHaveBeenCalledTimes(1);
    expect(mockSendInvite).toHaveBeenCalledWith('bob@example.com', base.fromUsername, base.boardTitle);
  });

  test('sends assignment email for type "assigned"', async () => {
    await createNotification({ ...base, userId: 'bob', type: 'assigned' });
    expect(mockSendAssignment).toHaveBeenCalledTimes(1);
    expect(mockSendAssignment).toHaveBeenCalledWith(
      'bob@example.com', base.fromUsername, base.boardTitle, base.cardTitle,
      base.boardId, base.cardId, base.columnId
    );
  });

  test('sends mention email for type "mentioned" with commentText', async () => {
    await createNotification({ ...base, userId: 'bob', type: 'mentioned', commentText: 'hey @bob!' });
    expect(mockSendMention).toHaveBeenCalledTimes(1);
    expect(mockSendMention).toHaveBeenCalledWith(
      'bob@example.com', base.fromUsername, base.boardTitle, base.cardTitle,
      'hey @bob!', base.boardId, base.cardId, base.columnId
    );
  });

  test('does not send email for type "invite_accepted"', async () => {
    await createNotification({ ...base, userId: 'bob', type: 'invite_accepted' });
    expect(mockSendInvite).not.toHaveBeenCalled();
    expect(mockSendAssignment).not.toHaveBeenCalled();
    expect(mockSendMention).not.toHaveBeenCalled();
  });

  test('does not send email for type "invite_rejected"', async () => {
    await createNotification({ ...base, userId: 'bob', type: 'invite_rejected' });
    expect(mockSendInvite).not.toHaveBeenCalled();
    expect(mockSendAssignment).not.toHaveBeenCalled();
    expect(mockSendMention).not.toHaveBeenCalled();
  });

  test('does not crash when user has no email in DB', async () => {
    await expect(
      createNotification({ ...base, userId: 'ghost', type: 'assigned' })
    ).resolves.toBeDefined();
    expect(mockSendAssignment).not.toHaveBeenCalled();
  });

  test('stores commentText in DB when provided', async () => {
    await createNotification({
      ...base, userId: 'bob', type: 'mentioned', commentText: 'check this out',
    });
    const doc = await getDB().collection('notifications').findOne({ userId: 'bob', commentText: 'check this out' });
    expect(doc?.commentText).toBe('check this out');
  });
});
