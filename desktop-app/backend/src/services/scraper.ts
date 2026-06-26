import { Page } from 'playwright';
import { launchBrowser } from '../utils/browser';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { evaluateJob } from './evaluator';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/environment';
import { decrypt } from '../utils/crypto';

const prisma = new PrismaClient();

interface ScrapedJobCard {
  jobId: string;
  title: string;
  company: string;
  location: string;
  linkedinUrl: string;
}

const BAD_PATTERNS = [
  '2+ years',
  '3+ years',
  '4+ years',
  '5+ years',
  '6+ years',
  '7+ years',
  'minimum 2 years',
  'minimum 3 years',
  'at least 2 years',
  'at least 3 years',
  'experience of 2-5 years',
  'experience of 3+'
];

export async function runScraperForUser(userId: string): Promise<number> {
  logger.info(`Starting LinkedIn job scraping run for user ${userId} (Conservative safety mode)...`);
  
  let pref = await prisma.userPreference.findFirst({
    where: { userId }
  });
  
  if (!pref) {
    pref = await prisma.userPreference.create({
      data: {
        userId,
        roles: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
        experience: ['0', '0-1'],
        techStack: ['Node.js', 'Python', 'Golang'],
        locations: ['Bangalore'],
        excludeCos: ['TCS', 'Infosys', 'Wipro'],
        excludeRls: ['Senior', 'Lead', 'SDE II', 'SDE III', 'Manager', 'Principal'],
        rawJson: '{}',
        chatHistory: '[]'
      }
    });
  }

  const keywords = pref.roles.length > 0 ? pref.roles : ['Software Engineer'];
  const locations = pref.locations.length > 0 ? pref.locations : ['Bangalore'];
  const excludeCos = pref.excludeCos.map(c => c.toLowerCase());
  const excludeRls = pref.excludeRls.map(r => r.toLowerCase());

  let maxJobs = 20;
  try {
    const maxJobsSetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'max_jobs_scraped' }
    });
    if (maxJobsSetting && maxJobsSetting.value) {
      const parsedVal = parseInt(maxJobsSetting.value, 10);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        maxJobs = parsedVal;
      }
    }
  } catch (err) {
    logger.error(`Failed to load max_jobs_scraped setting for user ${userId}`, err);
  }

  const { browser, context } = await launchBrowser(userId, true, true);
  const page = await context.newPage();
  let totalSaved = 0;

  try {
    for (const location of locations) {
      for (const keyword of keywords) {
        if (totalSaved >= maxJobs) break;
        logger.info(`Scraping keyword: "${keyword}" in "${location}"`);
        
        const encodedKeyword = encodeURIComponent(keyword);
        const encodedLocation = encodeURIComponent(location);
        const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=r86400&f_E=2%2C3`;
        
        logger.info(`Navigating to URL: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(4000 + Math.random() * 3000);

        const isLoggedIn = (await page.$('.global-nav')) !== null;
        logger.info(`Session status: ${isLoggedIn ? 'LOGGED_IN' : 'ANONYMOUS'}`);

        let jobCards: ScrapedJobCard[] = [];
        if (isLoggedIn) {
          jobCards = await scrapeLoggedInCards(page);
        } else {
          jobCards = await scrapeAnonymousCards(page);
        }

        logger.info(`Found ${jobCards.length} job cards for keyword "${keyword}" in "${location}"`);

        for (const card of jobCards) {
          if (totalSaved >= maxJobs) {
            logger.info(`Reached maximum job limit of ${maxJobs}. Stopping scraper.`);
            break;
          }
          await page.waitForTimeout(5000 + Math.random() * 5000);

          const lowerCompany = card.company.toLowerCase();
          const lowerTitle = card.title.toLowerCase();

          const isExcludedCompany = excludeCos.some(co => lowerCompany.includes(co));
          const isExcludedTitle = excludeRls.some(r => lowerTitle.includes(r));

          if (isExcludedCompany || isExcludedTitle) {
            logger.info(`Skipping excluded company/title: "${card.title}" at "${card.company}"`);
            continue;
          }

          // Duplicate Check scoped to user
          const existingJobById = await prisma.job.findFirst({
            where: { jobId: card.jobId, userId }
          });

          const existingAppliedJob = await prisma.job.findFirst({
            where: {
              userId,
              company: card.company,
              title: card.title,
              status: { in: ['Applied_Auto', 'Applied_Manual', 'Queue'] }
            }
          });

          if (existingJobById || existingAppliedJob) {
            logger.info(`Duplicate detected for: "${card.title}" at "${card.company}". Saving as Skipped.`);
            if (!existingJobById) {
              await prisma.job.create({
                data: {
                  userId,
                  jobId: card.jobId,
                  title: card.title,
                  company: card.company,
                  location: card.location,
                  linkedinUrl: card.linkedinUrl,
                  description: 'Duplicate application skipped.',
                  status: 'Skipped',
                  skipReason: 'Already Applied'
                }
              });
            }
            continue;
          }

          // Semantic Role Check
          const isMatch = await verifyTitleSemantic(userId, card.title, pref.roles, pref.excludeRls);
          if (!isMatch) {
            logger.info(`Title "${card.title}" failed semantic role matching. Skipping.`);
            continue;
          }

          try {
            logger.info(`Opening job detail: ${card.title} at ${card.company}`);
            await page.goto(card.linkedinUrl, { waitUntil: 'networkidle', timeout: 45000 });
            await page.waitForTimeout(3000);

            const details = await extractJobDetails(page, isLoggedIn);
            if (!details.description) {
              logger.warn(`Failed to extract description for job ${card.jobId}. Skipping.`);
              continue;
            }

            const containsBadPattern = BAD_PATTERNS.some(pattern => 
              details.description.toLowerCase().includes(pattern.toLowerCase())
            );
            
            if (containsBadPattern) {
              logger.info(`Job ${card.jobId} contains experience filter block pattern. Skipping.`);
              continue;
            }

            const savedJob = await prisma.job.create({
              data: {
                userId,
                jobId: card.jobId,
                title: card.title,
                company: card.company,
                location: card.location,
                linkedinUrl: card.linkedinUrl,
                description: details.description,
                applyUrl: details.applyUrl,
                experienceRequired: details.experience,
                employmentType: details.employmentType,
                status: 'Evaluating'
              }
            });

            totalSaved++;

            logger.info(`Evaluating matching score for job ${card.jobId} with Gemini...`);
            const evaluation = await evaluateJob(userId, card.title, card.company, details.description);
            
            const isEasyApply = details.applyUrl === null || details.applyUrl.toLowerCase().includes('easyapply') || details.applyUrl === '';
            let newStatus = 'Scraped';
            if (evaluation.score >= 3.0) {
              newStatus = isEasyApply ? 'Queue' : 'Applied_Manual';
            }

            await prisma.job.update({
              where: { id: savedJob.id },
              data: {
                score: evaluation.score,
                matchAnalysis: JSON.stringify({
                  matchingSkills: evaluation.matchingSkills,
                  missingSkills: evaluation.missingSkills,
                  reason: evaluation.reason
                }),
                applyUrl: details.applyUrl || card.linkedinUrl,
                status: newStatus
              }
            });
            
            logger.info(`Job ${card.jobId} evaluated. Score: ${evaluation.score}/5.0, Status: ${newStatus}`);

          } catch (cardError) {
            logger.error(`Error processing job card ${card.jobId}`, cardError);
          }
        }
        if (totalSaved >= maxJobs) break;
      }
      if (totalSaved >= maxJobs) break;
    }
  } catch (error) {
    logger.error('Error during scraper execution', error);
  } finally {
    await browser.close();
    logger.info(`LinkedIn scraper run completed. Saved & evaluated ${totalSaved} new jobs.`);
  }

  return totalSaved;
}

async function verifyTitleSemantic(userId: string, title: string, preferredRoles: string[], excludedRoles: string[]): Promise<boolean> {
  let apiKey = config.GEMINI_API_KEY;
  try {
    const keySetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'gemini_api_key' }
    });
    if (keySetting && keySetting.value) {
      apiKey = decrypt(keySetting.value);
    }
  } catch (err) {
    logger.error('Failed to get Gemini key for title check', err);
  }

  if (!apiKey) {
    const lowerTitle = title.toLowerCase();
    const matchesPreferred = preferredRoles.some(role => {
      const words = role.toLowerCase().split(' ');
      return words.every(w => lowerTitle.includes(w));
    });
    const matchesExcluded = excludedRoles.some(ex => lowerTitle.includes(ex.toLowerCase()));
    return matchesPreferred && !matchesExcluded;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
Determine if the Job Title matches the candidate's preferred target roles, and is NOT a senior/management position.

Job Title: "${title}"
Preferred Roles: ${JSON.stringify(preferredRoles)}
Excluded Roles/Seniorities: ${JSON.stringify(excludedRoles)}

Rule:
- Reject SDE II, SDE III, Senior, Staff, Principal, Lead, Architect, or Manager roles. We only want fresher/entry-level/junior roles.
- Allow matching synonyms (e.g., "Software Developer" matches "Software Engineer", "Fullstack Developer" matches "Full Stack Engineer").

Respond ONLY with a JSON object (no markdown formatting \`\`\`json wrappers):
{
  "isMatch": boolean
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt
    });

    let text = (response.text || '').trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);
    text = text.trim();

    const result = JSON.parse(text);
    return result.isMatch === true;
  } catch (err) {
    logger.error('Semantic role checking failed. Falling back to offline check.', err);
    const lowerTitle = title.toLowerCase();
    const matchesPreferred = preferredRoles.some(role => lowerTitle.includes(role.toLowerCase()));
    const matchesExcluded = excludedRoles.some(ex => lowerTitle.includes(ex.toLowerCase()));
    return matchesPreferred && !matchesExcluded;
  }
}

async function scrapeAnonymousCards(page: Page): Promise<ScrapedJobCard[]> {
  logger.info('Scrolling public search page...');
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1500);
  }

  const cards = await page.$$('.base-card, .job-search-card');
  const results: ScrapedJobCard[] = [];

  for (const card of cards) {
    try {
      const titleEl = await card.$('.base-search-card__title');
      const companyEl = await card.$('.base-search-card__subtitle');
      const locationEl = await card.$('.base-search-card__metadata-item');
      const linkEl = await card.$('a.base-card__full-link, a.job-search-card__link');

      if (titleEl && companyEl && linkEl) {
        const title = (await titleEl.innerText()).trim();
        const company = (await companyEl.innerText()).trim();
        const location = locationEl ? (await locationEl.innerText()).trim() : '';
        const href = (await linkEl.getAttribute('href')) || '';
        
        const jobIdMatch = href.match(/view\/.*?(\d+)/) || href.match(/jobs\/view\/(\d+)/) || href.match(/currentJobId=(\d+)/);
        const jobId = jobIdMatch ? jobIdMatch[1] : '';

        if (jobId && title) {
          results.push({
            jobId,
            title,
            company,
            location,
            linkedinUrl: `https://www.linkedin.com/jobs/view/${jobId}`
          });
        }
      }
    } catch (e) {
      logger.error('Failed to parse anonymous card element', e);
    }
  }

  return results;
}

async function scrapeLoggedInCards(page: Page): Promise<ScrapedJobCard[]> {
  logger.info('Scrolling logged-in search list...');
  const listContainer = await page.$('.jobs-search-results-list');
  if (listContainer) {
    for (let i = 0; i < 6; i++) {
      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, listContainer);
      await page.waitForTimeout(2000);
    }
  }

  const cards = await page.$$('.jobs-search-results-list__list-item, [data-occludable-job-id]');
  const results: ScrapedJobCard[] = [];

  for (const card of cards) {
    try {
      const jobId = await card.getAttribute('data-occludable-job-id') || '';
      const titleEl = await card.$('.job-card-list__title, .job-card-container__link');
      const companyEl = await card.$('.job-card-container__primary-description, .job-card-container__company-name');
      const locationEl = await card.$('.job-card-container__metadata-item');

      if (jobId && titleEl && companyEl) {
        const title = (await titleEl.innerText()).trim();
        const company = (await companyEl.innerText()).trim();
        const location = locationEl ? (await locationEl.innerText()).trim() : '';

        results.push({
          jobId,
          title,
          company,
          location,
          linkedinUrl: `https://www.linkedin.com/jobs/view/${jobId}`
        });
      }
    } catch (e) {
      logger.error('Failed to parse logged-in card element', e);
    }
  }

  return results;
}

interface ExtractedDetails {
  description: string;
  applyUrl: string | null;
  experience: string | null;
  employmentType: string | null;
}

async function extractJobDetails(page: Page, isLoggedIn: boolean): Promise<ExtractedDetails> {
  const result: ExtractedDetails = {
    description: '',
    applyUrl: null,
    experience: null,
    employmentType: null
  };

  try {
    if (isLoggedIn) {
      const descEl = await page.$('.jobs-description__content, #job-details');
      if (descEl) {
        result.description = (await descEl.innerText()).trim();
      }

      const easyApplyBtn = await page.$('.jobs-apply-button');
      if (easyApplyBtn) {
        result.applyUrl = 'easyapply';
      } else {
        const externalApplyBtn = await page.$('.jobs-apply-button--external, a.jobs-apply-button');
        if (externalApplyBtn) {
          const tag = await externalApplyBtn.evaluate(el => el.tagName.toLowerCase());
          if (tag === 'a') {
            result.applyUrl = await externalApplyBtn.getAttribute('href');
          } else {
            result.applyUrl = 'external-redirect';
          }
        }
      }

      const insightItems = await page.$$('.jobs-unified-top-card__job-insight');
      for (const item of insightItems) {
        const text = await item.innerText();
        if (text.includes('Full-time') || text.includes('Part-time') || text.includes('Contract')) {
          result.employmentType = text.split('·')[0].trim();
          result.experience = text.split('·')[1]?.trim() || null;
        }
      }
    } else {
      const descEl = await page.$('.description__text, .show-more-less-html__markup');
      if (descEl) {
        result.description = (await descEl.innerText()).trim();
      }

      const easyApplyBtn = await page.$('.apply-button--easy-apply');
      if (easyApplyBtn) {
        result.applyUrl = 'easyapply';
      } else {
        const externalApplyBtn = await page.$('a.apply-button');
        if (externalApplyBtn) {
          result.applyUrl = await externalApplyBtn.getAttribute('href');
        }
      }

      const critItems = await page.$$('.description__job-criteria-item');
      for (const item of critItems) {
        const headerEl = await item.$('.description__job-criteria-subheader');
        const valEl = await item.$('.description__job-criteria-text');
        if (headerEl && valEl) {
          const header = (await headerEl.innerText()).trim();
          const val = (await valEl.innerText()).trim();
          if (header.includes('Seniority level')) {
            result.experience = val;
          } else if (header.includes('Employment type')) {
            result.employmentType = val;
          }
        }
      }
    }
  } catch (err) {
    logger.error('Failed to extract job details from page', err);
  }

  return result;
}
