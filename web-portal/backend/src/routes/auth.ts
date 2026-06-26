import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'jobhit_web_portal_jwt_secret';

// Password hashing helpers
const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// POST: /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, hasPaid: false }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email, hasPaid: user.hasPaid });
  } catch (error) {
    logger.error('Registration failed', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST: /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email, hasPaid: user.hasPaid });
  } catch (error) {
    logger.error('Login failed', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET: /api/auth/me (Get profile and payment status)
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ email: user.email, hasPaid: user.hasPaid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// POST: /api/auth/pay (Mock payment endpoint - unlocks download)
router.post('/pay', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { hasPaid: true }
    });
    res.json({ message: 'Payment of 1 Rupee successful! Desktop app unlocked.', hasPaid: user.hasPaid });
  } catch (error) {
    logger.error('Payment processing failed', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// GET: /api/auth/download (Secure download endpoint serving desktop-app.zip)
router.get('/download', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.hasPaid) {
      return res.status(403).json({ error: 'Access denied. Please pay 1 Rupee to unlock the download.' });
    }

    const zipPath = path.join(__dirname, '../downloads/desktop-app.zip');
    if (!fs.existsSync(zipPath)) {
      logger.error(`Desktop app zip file not found at: ${zipPath}`);
      return res.status(404).json({ error: 'Desktop build file not found. Please contact support or rebuild.' });
    }

    res.download(zipPath, 'desktop-app.zip');
  } catch (error) {
    logger.error('Download failed', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

export default router;
