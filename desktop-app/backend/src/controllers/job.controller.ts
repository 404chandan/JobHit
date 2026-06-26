import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runScraperForUser } from '../services/scraper';
import { runAutoApplier } from '../services/applier';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getJobs = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const { status, minScore, dayFilter } = req.query;

    const whereClause: any = { userId };

    if (status) {
      whereClause.status = status as string;
    }

    if (minScore) {
      whereClause.score = {
        gte: parseFloat(minScore as string)
      };
    }

    if (dayFilter) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dayFilter === 'today') {
        whereClause.createdAt = { gte: startOfDay };
      } else if (dayFilter === 'yesterday') {
        const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
        whereClause.createdAt = {
          gte: startOfYesterday,
          lt: startOfDay
        };
      } else if (dayFilter === 'week') {
        const startOfWeek = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
        whereClause.createdAt = { gte: startOfWeek };
      }
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    res.json(jobs);
  } catch (error) {
    logger.error('Failed to get jobs', error);
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
};

export const triggerScrape = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  runScraperForUser(userId)
    .then((count: number) => logger.info(`Scraper finished for user ${userId}, imported ${count} jobs`))
    .catch((err: any) => logger.error(`Scraper failed for user ${userId}`, err));

  res.json({ message: 'LinkedIn scraping started in the background.' });
};

export const triggerAutoApply = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  
  if (!id) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  // Confirm job belongs to user
  const job = await prisma.job.findFirst({ where: { id, userId } });
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  runAutoApplier(id)
    .then(success => logger.info(`Manual auto-apply for job ${id}: ${success ? 'SUCCESS' : 'FAILED'}`))
    .catch(err => logger.error(`Manual auto-apply failed for job ${id}`, err));

  res.json({ message: 'Auto-apply sequence initiated in the background.' });
};

export const resolveScreeningQuestions = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { answers } = req.body; // Array of { questionText: string, answerText: string }

  if (!id || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Job ID and answers array are required' });
  }

  try {
    const job = await prisma.job.findFirst({ where: { id, userId } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // 1. Save answers to ScreeningQuestion patterns for future learning
    for (const ans of answers) {
      await prisma.screeningQuestion.upsert({
        where: {
          userId_questionText: { userId, questionText: ans.questionText }
        },
        update: { answerText: ans.answerText, updatedAt: new Date() },
        create: { userId, questionText: ans.questionText, answerText: ans.answerText }
      });
    }

    // 2. Clear unresolved questions from this job and set state back to Queue
    await prisma.job.update({
      where: { id },
      data: {
        status: 'Queue',
        unresolvedQuestions: null
      }
    });

    // 3. Immediately trigger auto-applier retry
    runAutoApplier(id)
      .then(success => logger.info(`Auto-apply retry for job ${id}: ${success ? 'SUCCESS' : 'FAILED'}`))
      .catch(err => logger.error(`Auto-apply retry failed for job ${id}`, err));

    res.json({ message: 'Answers saved. Resuming application in background.' });
  } catch (error) {
    logger.error(`Failed to resolve screening questions for job ${id}`, error);
    res.status(500).json({ error: 'Failed to process answers' });
  }
};
