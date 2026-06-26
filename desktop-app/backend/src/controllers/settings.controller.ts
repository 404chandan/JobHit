import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();

// List of settings keys that should be encrypted before writing to database
const SENSITIVE_KEYS = ['gemini_api_key', 'linkedin_cookies', 'smtp_config'];

export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: { userId }
    });
    
    // Map settings array to a key-value object and mask sensitive data
    const settingsMap = settings.reduce((acc: any, curr) => {
      if (SENSITIVE_KEYS.includes(curr.key)) {
        // Retrieve decrypted structure so we know if it has values, but mask value strings
        const decryptedVal = decrypt(curr.value);
        if (curr.key === 'gemini_api_key') {
          acc[curr.key] = decryptedVal ? '••••••••••••••••' : '';
        } else if (curr.key === 'linkedin_cookies') {
          acc[curr.key] = decryptedVal && decryptedVal !== '[]' ? '[{"name": "session_mask", "value": "••••"}]' : '[]';
        } else if (curr.key === 'smtp_config') {
          try {
            const parsed = JSON.parse(decryptedVal);
            acc[curr.key] = JSON.stringify({
              host: parsed.host || '',
              port: parsed.port || '',
              secure: parsed.secure,
              user: parsed.user || '',
              pass: parsed.pass ? '••••••••••••••••' : '',
              from: parsed.from || ''
            }, null, 2);
          } catch (e) {
            acc[curr.key] = '{"secure_config": "••••"}';
          }
        }
      } else {
        acc[curr.key] = curr.value;
      }
      return acc;
    }, {});

    res.json(settingsMap);
  } catch (error) {
    logger.error('Failed to retrieve system settings', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
};

export const saveSettings = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Setting Key is required' });
  }

  try {
    let finalValue = value;

    // Encrypt sensitive parameters
    if (SENSITIVE_KEYS.includes(key)) {
      // If client sends masked indicators (e.g. user didn't modify masked inputs), skip updating!
      if (value === '••••••••••••••••' || value.includes('session_mask') || (key === 'smtp_config' && value.includes('••••••••••••••••'))) {
        logger.info(`Settings key "${key}" received mask indicator, skipping database update.`);
        return res.json({ message: 'Setting unchanged.' });
      }
      finalValue = encrypt(value);
    }

    const existing = await prisma.systemSetting.findFirst({
      where: { userId, key }
    });

    let updated;
    if (existing) {
      updated = await prisma.systemSetting.update({
        where: { id: existing.id },
        data: { value: finalValue, updatedAt: new Date() }
      });
    } else {
      updated = await prisma.systemSetting.create({
        data: { userId, key, value: finalValue, updatedAt: new Date() }
      });
    }

    res.json({ message: 'Setting saved successfully.', key: updated.key });
  } catch (error) {
    logger.error(`Failed to save setting for key "${key}"`, error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
};

export const uploadResumeFile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  if (!req.file) {
    return res.status(400).json({ error: 'No resume file uploaded' });
  }

  try {
    logger.info('Parsing uploaded PDF resume...');
    const buffer = req.file.buffer;
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text.trim();

    if (!resumeText) {
      return res.status(400).json({ error: 'Could not extract text from the PDF file' });
    }

    const existingResume = await prisma.systemSetting.findFirst({
      where: { userId, key: 'user_resume' }
    });

    if (existingResume) {
      await prisma.systemSetting.update({
        where: { id: existingResume.id },
        data: { value: resumeText, updatedAt: new Date() }
      });
    } else {
      await prisma.systemSetting.create({
        data: { userId, key: 'user_resume', value: resumeText, updatedAt: new Date() }
      });
    }

    logger.info('Resume text extracted and saved to DB');
    res.json({ message: 'Resume uploaded and parsed successfully', resumeText });
  } catch (error) {
    logger.error('Failed to parse uploaded resume file', error);
    res.status(500).json({ error: 'Failed to process resume PDF file' });
  }
};
