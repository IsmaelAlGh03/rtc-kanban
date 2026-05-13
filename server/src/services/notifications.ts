import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { getDB } from '../db';

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
  return inserted;
}
