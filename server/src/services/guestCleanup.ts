import { getDB } from '../db';
import { IBoard } from '../models/Board';

const GUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000; // delete guests after ~3 days
const SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000; // run twice a day

/**
 * Deletes guest accounts older than the TTL along with their data:
 * boards they own, their notifications, and their membership in other boards.
 */
export async function cleanupExpiredGuests(): Promise<number> {
  const db = getDB();
  const threshold = new Date(Date.now() - GUEST_TTL_MS);

  const expired = await db
    .collection('users')
    .find({ guest: true, createdAt: { $lt: threshold } })
    .toArray();

  if (expired.length === 0) return 0;

  const usernames = expired.map((u) => u.username as string);

  await db.collection<IBoard>('boards').deleteMany({ owner: { $in: usernames } });
  await db.collection('boards').updateMany(
    { $or: [{ members: { $in: usernames } }, { pendingInvites: { $in: usernames } }] },
    { $pull: { members: { $in: usernames }, pendingInvites: { $in: usernames } } as any }
  );
  await db.collection('notifications').deleteMany({ userId: { $in: usernames } });
  await db.collection('users').deleteMany({ username: { $in: usernames } });

  console.log(`Guest cleanup: removed ${usernames.length} expired guest account(s)`);
  return usernames.length;
}

export function startGuestCleanup(): void {
  cleanupExpiredGuests().catch((err) => console.error('Guest cleanup error:', err));
  setInterval(() => {
    cleanupExpiredGuests().catch((err) => console.error('Guest cleanup error:', err));
  }, SWEEP_INTERVAL_MS).unref();
}
