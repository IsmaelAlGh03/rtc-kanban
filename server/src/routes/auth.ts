import { Router, Request, Response } from 'express';
import { IBoard } from '../models/Board';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { getDB } from '../db';
import { JWT_SECRET } from '../config';
import { sendConfirmationEmail, sendPasswordResetEmail } from '../services/email';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many registration attempts, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = [
  { re: /.{8,}/, msg: 'at least 8 characters' },
  { re: /[A-Z]/, msg: 'at least one uppercase letter' },
  { re: /[0-9]/, msg: 'at least one number' },
  { re: /[^A-Za-z0-9]/, msg: 'at least one special character' },
];

function validatePassword(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.re.test(password)) {
      return `Password must contain ${rule.msg}`;
    }
  }
  return null;
}

router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (username.includes('@')) {
    res.status(400).json({ error: 'Username cannot contain @' });
    return;
  }
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  const name = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  const existingUsername = await getDB().collection('users').findOne({ username: name });
  if (existingUsername) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const existingEmail = await getDB().collection('users').findOne({ email: normalizedEmail });
  if (existingEmail) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const gravatarHash = crypto.createHash('md5').update(normalizedEmail).digest('hex');

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await getDB().collection('users').insertOne({
    username: name,
    email: normalizedEmail,
    passwordHash,
    gravatarHash,
    emailVerified: false,
    emailVerificationToken: verifyToken,
    emailVerificationExpires: tokenExpiry,
  });

  sendConfirmationEmail(normalizedEmail, name, verifyToken).catch(err =>
    console.error('Failed to send confirmation email:', err)
  );

  const jwtToken = jwt.sign({ username: name }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token: jwtToken, username: name });
});

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { identifier, password } = req.body;
  if (!identifier?.trim() || !password) {
    res.status(400).json({ error: 'Identifier and password are required' });
    return;
  }

  const value = identifier.trim();
  const user = await getDB().collection('users').findOne({
    $or: [{ username: value }, { email: value.toLowerCase() }],
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await getDB().collection('users').findOne({ username: req.username });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({
    username: user.username,
    emailVerified: user.emailVerified ?? false,
    displayName: user.displayName ?? user.username,
    bio: user.bio ?? '',
    gravatarHash: user.gravatarHash ?? '',
  });
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { displayName, bio } = req.body;
  const update: Record<string, string> = {};

  if (displayName !== undefined) {
    const trimmed = String(displayName).trim();
    if (trimmed.length > 50) {
      res.status(400).json({ error: 'Display name must be 50 characters or fewer' });
      return;
    }
    update.displayName = trimmed;
  }

  if (bio !== undefined) {
    const trimmed = String(bio).trim();
    if (trimmed.length > 200) {
      res.status(400).json({ error: 'Bio must be 200 characters or fewer' });
      return;
    }
    update.bio = trimmed;
  }

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  await getDB().collection('users').updateOne({ username: req.username }, { $set: update });
  res.json({ message: 'Profile updated' });
});

router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Verification token is required' });
    return;
  }
  const user = await getDB().collection('users').findOne({ emailVerificationToken: token });
  if (!user) {
    res.status(400).json({ error: 'Invalid verification token' });
    return;
  }
  if (new Date(user.emailVerificationExpires) < new Date()) {
    res.status(400).json({ error: 'Verification token has expired' });
    return;
  }
  await getDB().collection('users').updateOne(
    { _id: user._id },
    { $set: { emailVerified: true }, $unset: { emailVerificationToken: '', emailVerificationExpires: '' } }
  );
  res.json({ message: 'Email verified successfully' });
});

router.post('/resend-verification', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await getDB().collection('users').findOne({ username: req.username });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (user.emailVerified) {
    res.status(400).json({ error: 'Email is already verified' });
    return;
  }
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await getDB().collection('users').updateOne(
    { _id: user._id },
    { $set: { emailVerificationToken: verifyToken, emailVerificationExpires: tokenExpiry } }
  );
  sendConfirmationEmail(user.email, user.username, verifyToken).catch(err =>
    console.error('Failed to resend confirmation email:', err)
  );
  res.json({ message: 'Verification email sent' });
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await getDB().collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    res.json({ message: 'If that email exists, a reset link has been sent' });
    return;
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await getDB().collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordResetToken: resetToken, passwordResetExpires: tokenExpiry } }
  );
  sendPasswordResetEmail(normalizedEmail, user.username, resetToken).catch(err =>
    console.error('Failed to send password reset email:', err)
  );
  res.json({ message: 'If that email exists, a reset link has been sent' });
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword: password } = req.body;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Reset token is required' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }
  const user = await getDB().collection('users').findOne({ passwordResetToken: token });
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }
  if (new Date(user.passwordResetExpires) < new Date()) {
    res.status(400).json({ error: 'Reset token has expired' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await getDB().collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordHash }, $unset: { passwordResetToken: '', passwordResetExpires: '' } }
  );
  res.json({ message: 'Password reset successfully' });
});

router.delete('/account', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.username!;
  const db = getDB();
  try {
    const ownedBoards = await db.collection<IBoard>('boards').find({ owner: username }).toArray();
    for (const board of ownedBoards) {
      if (board.members.length > 0) {
        const [newOwner, ...remainingMembers] = board.members;
        await db.collection('boards').updateOne(
          { _id: board._id as any },
          { $set: { owner: newOwner, members: remainingMembers } }
        );
      } else {
        await db.collection('boards').deleteOne({ _id: board._id as any });
      }
    }
    await db.collection('boards').updateMany(
      { $or: [{ members: username }, { pendingInvites: username }] },
      { $pull: { members: username, pendingInvites: username } as any }
    );
    await db.collection('notifications').deleteMany({ userId: username });
    await db.collection('users').deleteOne({ username });
    res.json({ message: 'Account deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
