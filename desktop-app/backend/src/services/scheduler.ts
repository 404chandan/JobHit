import cron from 'node-cron';
import { runScraperForUser } from './scraper';
import { runAutoApplier } from './applier';
import { dispatchMorningEmailsForUser, scrapeNewStartupLeads, seedStartupsForUser } from './emailer';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function initScheduler() {
  logger.info('Initializing background job scheduler...');

  // Periodic multi-user scheduler checking active users
  // 1. LinkedIn Job Scraper: Runs every 8 hours
  cron.schedule('0 */8 * * *', async () => {
    logger.info('Scheduler triggered: LinkedIn Job Scraper (8-Hour Safety Mode)');
    try {
      const users = await prisma.user.findMany();
      for (const user of users) {
        // Seed default startups if empty
        await seedStartupsForUser(user.id);
        
        logger.info(`Running scraper sequence for User: ${user.email}`);
        const count = await runScraperForUser(user.id);
        logger.info(`Scheduler: Scraped and evaluated ${count} jobs for user ${user.email}.`);
        
        // Auto-trigger appplier for this user
        await triggerAutoApplyQueueForUser(user.id);
      }
    } catch (e) {
      logger.error('Scheduler LinkedIn Job Scraper execution failed', e);
    }
  });

  // 2. Automated Morning Cold Email Dispatcher: Runs every morning at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Scheduler triggered: Morning Cold Emailing (9:00 AM)');
    try {
      const users = await prisma.user.findMany();
      for (const user of users) {
        logger.info(`Expanding lead pipeline for User: ${user.email}`);
        const leadsFound = await scrapeNewStartupLeads(user.id);
        logger.info(`Lead expansion done. Found ${leadsFound} recruiter contacts.`);

        const results = await dispatchMorningEmailsForUser(user.id);
        logger.info(`Morning cold emails dispatched for ${user.email}. Sent: ${results.sent}, Failed: ${results.failed}`);
      }
    } catch (e) {
      logger.error('Scheduler Morning Cold Emailing failed', e);
    }
  });

  logger.info('All cron schedules registered successfully.');
}

export async function triggerAutoApplyQueueForUser(userId: string): Promise<void> {
  logger.info(`Scanning for pending jobs in auto-apply Queue for user ${userId}...`);
  try {
    const queuedJobs = await prisma.job.findMany({
      where: { userId, status: 'Queue' }
    });

    if (queuedJobs.length === 0) {
      logger.info('No jobs in auto-apply Queue.');
      return;
    }

    logger.info(`Found ${queuedJobs.length} jobs in Queue. Starting sequential auto-applications...`);

    for (const job of queuedJobs) {
      try {
        await runAutoApplier(job.id);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (err) {
        logger.error(`Failed to execute auto-apply for job ${job.id}`, err);
      }
    }
  } catch (error) {
    logger.error('Error during auto-apply queue processing', error);
  }
}
