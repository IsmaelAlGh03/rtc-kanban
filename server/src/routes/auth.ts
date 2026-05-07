import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../db';
import { JWT_SECRET } from '../config';

const router = Router();

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

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'Username and password are required' });
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
  await getDB().collection('users').insertOne({ username: name, email: normalizedEmail, passwordHash });

  const token = jwt.sign({ username: name }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, username: name });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
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

export default router;
