import { MongoClient, Db } from 'mongodb';

let db: Db;

export async function connectDB(uri: string): Promise<void> {
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db('rtc-kanban');
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  console.log('Connected to MongoDB');
}

export function getDB(): Db {
  if (!db) throw new Error('DB not initialised — call connectDB first');
  return db;
}
