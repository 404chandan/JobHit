import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateColdEmailDraft, scrapeNewStartupLeads } from '../services/emailer';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

export const getContacts = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const contacts = await prisma.companyContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contacts);
  } catch (error) {
    logger.error('Failed to get contacts', error);
    res.status(500).json({ error: 'Failed to retrieve contacts' });
  }
};

export const updateDraft = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { emailDraft, status } = req.body;

  try {
    const contact = await prisma.companyContact.findFirst({ where: { id, userId } });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await prisma.companyContact.update({
      where: { id },
      data: {
        emailDraft,
        status: status || 'Drafted'
      }
    });
    res.json(updated);
  } catch (error) {
    logger.error(`Failed to update draft for contact ${id}`, error);
    res.status(500).json({ error: 'Failed to update email draft' });
  }
};

export const regenerateDraft = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  try {
    const contact = await prisma.companyContact.findFirst({ where: { id, userId } });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const draft = await generateColdEmailDraft(id);
    res.json({ draft });
  } catch (error) {
    logger.error(`Failed to regenerate draft for contact ${id}`, error);
    res.status(500).json({ error: 'Failed to regenerate draft' });
  }
};

export const sendSingleEmail = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  try {
    const contact = await prisma.companyContact.findFirst({ where: { id, userId } });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get SMTP settings and decrypt
    const smtpSetting = await prisma.systemSetting.findFirst({ where: { key: 'smtp_config', userId } });
    if (!smtpSetting) {
      return res.status(400).json({ error: 'SMTP settings not configured. Please save credentials first.' });
    }

    const smtpConfig = JSON.parse(decrypt(smtpSetting.value));
    if (!smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: 'SMTP username/password missing in configuration.' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host || 'smtp.gmail.com',
      port: parseInt(smtpConfig.port || '587'),
      secure: smtpConfig.secure === 'true' || smtpConfig.secure === true,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    let draftContent = contact.emailDraft;
    if (!draftContent) {
      draftContent = await generateColdEmailDraft(contact.id);
    }

    if (!draftContent) {
      return res.status(500).json({ error: 'Failed to construct email body.' });
    }

    // Parse subject and body
    const firstLineBreak = draftContent.indexOf('\n');
    let subject = `Job Inquiry: Software Engineering Opportunities at ${contact.companyName}`;
    let body = draftContent;

    if (draftContent.toLowerCase().startsWith('subject:')) {
      const line = draftContent.split('\n')[0];
      subject = line.replace(/subject:\s*/i, '').trim();
      body = draftContent.substring(firstLineBreak).trim();
    }

    await transporter.sendMail({
      from: smtpConfig.from || smtpConfig.user,
      to: contact.email,
      subject: subject,
      text: body
    });

    const updated = await prisma.companyContact.update({
      where: { id },
      data: {
        status: 'Sent',
        sentAt: new Date()
      }
    });

    res.json({ message: 'Email dispatched successfully.', contact: updated });
  } catch (error) {
    logger.error(`Failed to send single email for contact ${id}`, error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

export const triggerLeadGeneration = async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body;
  
  scrapeNewStartupLeads(query || 'tech startups Bangalore')
    .then(count => logger.info(`Lead generation finished. Found ${count} contacts`))
    .catch(err => logger.error('Lead generation failed', err));

  res.json({ message: 'Startup lead scraping started in the background.' });
};
