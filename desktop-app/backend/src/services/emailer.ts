import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { PrismaClient } from '@prisma/client';
import { getActiveResume } from './evaluator';
import { launchBrowser } from '../utils/browser';
import { decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

const SEED_STARTUPS = [
  { name: 'Razorpay', domain: 'razorpay.com', industry: 'Fintech / Payments' },
  { name: 'Cred', domain: 'cred.club', industry: 'Fintech / Credit Cards' },
  { name: 'Groww', domain: 'groww.in', industry: 'Fintech / Investing' },
  { name: 'Swiggy', domain: 'swiggy.com', industry: 'Food Delivery & Quick Commerce' },
  { name: 'Meesho', domain: 'meesho.com', industry: 'E-commerce' },
  { name: 'PhonePe', domain: 'phonepe.com', industry: 'Fintech / Payments' },
  { name: 'Zerodha', domain: 'zerodha.com', industry: 'Fintech / Stock Brokerage' },
  { name: 'Ather Energy', domain: 'atherenergy.com', industry: 'Electric Vehicles / IoT' },
  { name: 'slice', domain: 'sliceit.com', industry: 'Fintech / Banking' },
  { name: 'Pocket FM', domain: 'pocketfm.com', industry: 'Audio Streaming / Entertainment' },
  { name: 'Porter', domain: 'porter.in', industry: 'Logistics / Supply Chain' },
  { name: 'Jupiter', domain: 'jupiter.money', industry: 'Neobanking' },
  { name: 'Dunzo', domain: 'dunzo.com', industry: 'Logistics & Quick Commerce' },
  { name: 'Playo', domain: 'playo.co', industry: 'Sports Tech / Community' },
  { name: 'SigTuple', domain: 'sigtuple.com', industry: 'Healthtech / AI' }
];

export async function seedStartupsForUser(userId: string): Promise<void> {
  logger.info(`Seeding startup leads for user ${userId} in database...`);
  for (const startup of SEED_STARTUPS) {
    try {
      const hasContact = await prisma.companyContact.findFirst({
        where: { userId, companyName: startup.name }
      });

      if (!hasContact) {
        await prisma.companyContact.create({
          data: {
            userId,
            companyName: startup.name,
            contactName: 'Talent Acquisition Team',
            contactTitle: 'HR / Recruiter',
            email: `careers@${startup.domain}`,
            status: 'Drafted'
          }
        });
        await prisma.companyContact.create({
          data: {
            userId,
            companyName: startup.name,
            contactName: 'Engineering Hiring Lead',
            contactTitle: 'Engineering Manager',
            email: `engineering@${startup.domain}`,
            status: 'Drafted'
          }
        });
      }
    } catch (e) {
      logger.error(`Failed to seed contact for ${startup.name}`, e);
    }
  }
}

export async function scrapeNewStartupLeads(userId: string, keywordQuery = 'tech startups Bangalore'): Promise<number> {
  logger.info(`Searching for new startups and leads for user ${userId} using query: "${keywordQuery}"...`);
  const { browser, context } = await launchBrowser(userId, true, false);
  const page = await context.newPage();
  let foundCount = 0;

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(keywordQuery)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const searchTitles = await page.$$eval('#b_results .b_algo h2 a, .b_algo a', (links) => {
      return links.slice(0, 10).map(l => ({
        title: l.textContent || '',
        url: l.getAttribute('href') || ''
      }));
    });

    const candidateCompanies: string[] = [];
    for (const item of searchTitles) {
      const match = item.title.match(/([A-Z][a-zA-Z0-9]+)/);
      if (match && match[0] && !['Bing', 'Google', 'LinkedIn', 'Wikipedia', 'Find', 'Best'].includes(match[0])) {
        candidateCompanies.push(match[0]);
      }
    }

    const uniqueCompanies = Array.from(new Set(candidateCompanies)).slice(0, 5);
    logger.info(`Found candidate companies to inspect: ${uniqueCompanies.join(', ')}`);

    for (const company of uniqueCompanies) {
      const leadQuery = `"${company}" ("HR" OR "Talent Acquisition" OR "Founder") Bangalore site:linkedin.com/in/`;
      logger.info(`Searching leads for "${company}" with query: "${leadQuery}"`);
      try {
        await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(leadQuery)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (err) {
        logger.warn(`Navigation to lead search page for ${company} timed out, continuing...`);
      }

      const snippets = await page.$$eval('#b_results .b_algo', (blocks) => {
        return blocks.slice(0, 3).map(b => {
          const titleEl = b.querySelector('h2 a');
          const snippetEl = b.querySelector('.b_caption p, .b_algoSnippet');
          return {
            title: titleEl?.textContent || '',
            snippet: snippetEl?.textContent || ''
          };
        });
      });

      for (const item of snippets) {
        const titleParts = item.title.split(' - ');
        if (titleParts.length >= 2) {
          const name = titleParts[0].trim();
          let title = titleParts[1].split('|')[0].trim();
          
          if (name.length > 3 && name.length < 35 && !name.includes('LinkedIn')) {
            const domain = `${company.toLowerCase().replace(/\s+/g, '')}.com`;
            const hrEmail = `careers@${domain}`;
            
            const exists = await prisma.companyContact.findFirst({
              where: { userId, companyName: company, email: hrEmail }
            });

            if (!exists) {
              await prisma.companyContact.create({
                data: {
                  userId,
                  companyName: company,
                  contactName: name,
                  contactTitle: title || 'HR Manager',
                  email: hrEmail,
                  status: 'Drafted'
                }
              });
              foundCount++;
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to scrape startup leads', error);
  } finally {
    await browser.close();
  }

  return foundCount;
}

export async function generateColdEmailDraft(contactId: string): Promise<string> {
  const contact = await prisma.companyContact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');

  const userId = contact.userId;
  let apiKey = config.GEMINI_API_KEY;
  
  try {
    const keySetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'gemini_api_key' }
    });
    if (keySetting && keySetting.value) {
      apiKey = decrypt(keySetting.value);
    }
  } catch (e) {
    logger.error(`Failed to load Gemini Key for user ${userId}`, e);
  }

  const resume = await getActiveResume(userId);

  if (!apiKey) {
    const fallbackDraft = `Subject: Inquiry: Software Engineering Opportunities at ${contact.companyName}\n\nHi ${contact.contactName},\n\nI hope this email finds you well. I am Chandan Pandey, a Software Engineer with experience at Siemens and HighRadius. I am deeply interested in software development opportunities at ${contact.companyName}.\n\nI have attached my resume for your review.\n\nBest regards,\nChandan Pandey`;
    await prisma.companyContact.update({
      where: { id: contactId },
      data: { emailDraft: fallbackDraft }
    });
    return fallbackDraft;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are a career mentor drafting an elegant, highly effective cold email pitch.
Write a personalized cold email from the candidate (Chandan Pandey) to the contact.

### Contact Details
Company: ${contact.companyName}
Contact Name: ${contact.contactName}
Contact Role: ${contact.contactTitle}
Email: ${contact.email}

### Candidate's Resume
${resume}

### Writing Guidelines
1. Email must have a clear, compelling Subject Line.
2. The body must be concise (under 150 words).
3. Be professional yet enthusiastic. Mention his current role at Siemens or projects like ScaleCheck, aligning with the target company's business domain.
4. Direct call to action (e.g. brief chat next week).
5. Address the contact by their name.
6. Make sure the email does not contain placeholders. Use Chandan's actual details.

Respond ONLY with the drafted email text (Subject line first, followed by a double line break, then the body). Do not include any other markdown wrappers.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt
    });

    const draft = (response.text || '').trim();
    await prisma.companyContact.update({
      where: { id: contactId },
      data: { emailDraft: draft }
    });

    return draft;
  } catch (error) {
    logger.error(`Failed to generate email draft for contact ${contactId}`, error);
    return '';
  }
}

export async function dispatchMorningEmailsForUser(userId: string): Promise<{ sent: number; failed: number }> {
  logger.info(`Running automated morning cold-email dispatcher for user ${userId}...`);
  
  let smtpConfig: any = null;
  try {
    const smtpSetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'smtp_config' }
    });
    if (smtpSetting) {
      smtpConfig = JSON.parse(decrypt(smtpSetting.value));
    }
  } catch (err) {
    logger.error(`Failed to read SMTP config for user ${userId}`, err);
  }

  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    logger.warn(`SMTP configuration is missing or incomplete for user ${userId}. Skipping emailing.`);
    return { sent: 0, failed: 0 };
  }

  const transport = nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.gmail.com',
    port: parseInt(smtpConfig.port || '587'),
    secure: smtpConfig.secure === 'true' || smtpConfig.secure === true,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  });

  const pendingContacts = await prisma.companyContact.findMany({
    where: { userId, status: 'Drafted' }
  });

  let sent = 0;
  let failed = 0;

  for (const contact of pendingContacts) {
    try {
      let emailContent = contact.emailDraft;
      if (!emailContent) {
        emailContent = await generateColdEmailDraft(contact.id);
      }

      if (!emailContent) {
        logger.error(`Unable to generate email content for ${contact.contactName} at ${contact.companyName}. Skipping.`);
        failed++;
        continue;
      }

      const firstLineBreak = emailContent.indexOf('\n');
      let subject = `Software Engineering Roles at ${contact.companyName}`;
      let body = emailContent;

      if (emailContent.toLowerCase().startsWith('subject:')) {
        const line = emailContent.split('\n')[0];
        subject = line.replace(/subject:\s*/i, '').trim();
        body = emailContent.substring(firstLineBreak).trim();
      }

      logger.info(`Sending cold email to ${contact.contactName} (${contact.email})`);
      await transport.sendMail({
        from: smtpConfig.from || smtpConfig.user,
        to: contact.email,
        subject: subject,
        text: body
      });

      await prisma.companyContact.update({
        where: { id: contact.id },
        data: {
          status: 'Sent',
          sentAt: new Date()
        }
      });
      sent++;

      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (sendError) {
      logger.error(`Failed to send email to ${contact.email}`, sendError);
      await prisma.companyContact.update({
        where: { id: contact.id },
        data: { status: 'Failed' }
      });
      failed++;
    }
  }

  return { sent, failed };
}
