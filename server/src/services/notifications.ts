import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { sendInviteEmail, sendAssignmentEmail, sendMentionEmail } from './email';

export interface INotification {
  _id?: string;
  userId: string;
  type: 'invite' | 'invite_accepted' | 'invite_rejected' | 'assigned' | 'mentioned';
  boardId: string;
  boardTitle: string;
  fromUsername: string;
  cardId?: string;
  cardTitle?: string;
  columnId?: string;
  commentText?: string;
  read: boolean;
  createdAt: Date;
}

let _io: Server | null = null;

export function initNotificationService(io: Server) {
  _io = io;
}

export async function createNotification(data: Omit<INotification, '_id' | 'read' | 'createdAt'>) {
  const doc: INotification = { ...data, read: false, createdAt: new Date() };
  const result = await getDB().collection<INotification>('notifications').insertOne(doc as any);
  const inserted = { ...doc, _id: result.insertedId.toString() };
  _io?.to(data.userId).emit('notification:new', inserted);

  const user = await getDB().collection('users').findOne({ username: data.userId });
  if (user?.email) {
    if (data.type === 'invite') {
      sendInviteEmail(user.email, data.fromUsername, data.boardTitle).catch(err =>
        console.error('invite email error:', err)
      );
    } else if (data.type === 'assigned' && data.cardTitle && data.cardId && data.columnId) {
      sendAssignmentEmail(user.email, data.fromUsername, data.boardTitle, data.cardTitle, data.boardId, data.cardId, data.columnId).catch(err =>
        console.error('assignment email error:', err)
      );
    } else if (data.type === 'mentioned' && data.cardTitle && data.cardId && data.columnId && data.commentText) {
      sendMentionEmail(user.email, data.fromUsername, data.boardTitle, data.cardTitle, data.commentText, data.boardId, data.cardId, data.columnId).catch(err =>
        console.error('mention email error:', err)
      );
    }
  }

  return inserted;
}
