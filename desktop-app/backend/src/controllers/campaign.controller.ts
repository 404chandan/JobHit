import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  
  const companyIdx = headers.findIndex(h => h.includes('company'));
  const emailIdx = headers.findIndex(h => h.includes('email'));
  const nameIdx = headers.findIndex(h => h.includes('recipient') || h.includes('hr') || h.includes('name') || h.includes('contact'));

  if (companyIdx === -1 || emailIdx === -1) {
    throw new Error('CSV must contain at least "Company" and "Email" columns');
  }

  const results: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const columns: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let charIdx = 0; charIdx < row.length; charIdx++) {
      const char = row[charIdx];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(currentVal.trim().replace(/^["']|["']$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    columns.push(currentVal.trim().replace(/^["']|["']$/g, ''));

    if (columns.length > Math.max(companyIdx, emailIdx)) {
      const company = columns[companyIdx];
      const email = columns[emailIdx];
      const name = nameIdx !== -1 ? columns[nameIdx] : 'Talent Team';

      if (company && email && emailRegex.test(email)) {
        results.push({ company, email, name });
      }
    }
  }

  return results;
}

export const uploadCsvCampaign = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a CSV file' });
  }

  const { campaignName, templateText, subject } = req.body;
  if (!campaignName || !templateText || !subject) {
    return res.status(400).json({ error: 'Campaign name, subject line, and template text are required' });
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const parsedContacts = parseCsv(csvContent);

    if (parsedContacts.length === 0) {
      return res.status(400).json({ error: 'No valid rows found in the CSV. Make sure headers contain "Company" and "Email".' });
    }

    // 1. Create the Email Campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        name: campaignName,
        subject,
        template: templateText
      }
    });

    // 2. Insert Contacts
    let contactsCreated = 0;
    for (const record of parsedContacts) {
      const emailDraftText = `Subject: ${subject}\n\n${templateText
        .replace(/{{name}}/g, record.name)
        .replace(/{{company}}/g, record.company)
        .replace(/{{role}}/g, 'Software Engineer')}`;

      try {
        await prisma.companyContact.create({
          data: {
            userId,
            companyName: record.company,
            contactName: record.name,
            contactTitle: 'HR / Recruiter',
            email: record.email,
            emailDraft: emailDraftText,
            status: 'Drafted',
            campaignId: campaign.id
          }
        });
        contactsCreated++;
      } catch (dbErr) {
        logger.debug(`Duplicate contact skipped: ${record.email} for company ${record.company}`);
      }
    }

    res.json({
      message: `Campaign "${campaignName}" created successfully.`,
      contactsImported: contactsCreated,
      campaignId: campaign.id
    });

  } catch (error: any) {
    logger.error('Failed to parse uploaded campaign CSV', error);
    res.status(500).json({ error: error.message || 'Failed to process CSV file upload' });
  }
};

export const getCampaigns = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    logger.error('Failed to get campaigns', error);
    res.status(500).json({ error: 'Failed to retrieve campaigns' });
  }
};
