import { Page } from 'playwright';
import { launchBrowser } from '../utils/browser';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/environment';
import { decrypt } from '../utils/crypto';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

interface ScreeningQuestionForm {
  label: string;
  selector: string;
  type: 'text' | 'select' | 'radio' | 'checkbox';
  options?: string[];
}

export async function runAutoApplier(jobIdStr: string): Promise<boolean> {
  logger.info(`Starting auto-applier for Job: ${jobIdStr}`);
  
  const job = await prisma.job.findUnique({ where: { id: jobIdStr } });
  if (!job) {
    logger.error(`Job with ID ${jobIdStr} not found in database`);
    return false;
  }

  const userId = job.userId;

  const resumePath = path.join(UPLOADS_DIR, 'resume.pdf');
  if (!fs.existsSync(resumePath)) {
    fs.writeFileSync(resumePath, 'Chandan Pandey - Resume - Software Engineer at Siemens');
    logger.info('Created dummy resume.pdf for scraper use');
  }

  await prisma.job.update({
    where: { id: jobIdStr },
    data: { status: 'Evaluating' }
  });

  const { browser, context } = await launchBrowser(userId, false, true); 
  const page = await context.newPage();
  let success = false;

  try {
    logger.info(`Navigating to LinkedIn Job page: ${job.linkedinUrl}`);
    await page.goto(job.linkedinUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const easyApplyBtn = await page.$('.jobs-apply-button');
    if (!easyApplyBtn) {
      logger.warn(`No Easy Apply button found for Job ${job.jobId}. Setting status to Applied_Manual.`);
      await prisma.job.update({
        where: { id: jobIdStr },
        data: { status: 'Applied_Manual' }
      });
      return false;
    }

    const btnText = await easyApplyBtn.innerText();
    if (!btnText.toLowerCase().includes('easy apply')) {
      logger.warn(`Button text is not Easy Apply. Text: "${btnText}". Setting status to Applied_Manual.`);
      await prisma.job.update({
        where: { id: jobIdStr },
        data: { status: 'Applied_Manual' }
      });
      return false;
    }

    logger.info('Clicking Easy Apply button...');
    await easyApplyBtn.click();
    await page.waitForTimeout(3000);

    let currentStep = 1;
    let isFinished = false;
    const maxSteps = 10;

    while (currentStep <= maxSteps && !isFinished) {
      logger.info(`Processing application step ${currentStep}...`);
      await page.waitForTimeout(1000);

      const submitBtn = await page.$('button[aria-label="Submit application"]');
      const formFields = await detectFormQuestions(page);

      if (formFields.length > 0) {
        logger.info(`Detected ${formFields.length} custom questions on page`);
        
        const unresolved: ScreeningQuestionForm[] = [];

        for (const field of formFields) {
          const answered = await attemptFillField(userId, page, field);
          if (!answered) {
            unresolved.push(field);
          }
        }

        if (unresolved.length > 0) {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `${job.id}.png`);
          await page.screenshot({ path: screenshotPath });
          logger.warn(`Could not answer all questions. Saved screenshot. Storing unresolved questions.`);

          await prisma.job.update({
            where: { id: jobIdStr },
            data: {
              status: 'Requires_Action',
              unresolvedQuestions: JSON.stringify(unresolved)
            }
          });

          isFinished = true;
          break;
        }
      }

      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        logger.info('Detected file upload field (Resume). Uploading...');
        await fileInput.setInputFiles(resumePath);
        await page.waitForTimeout(2000);
      }

      const nextBtn = await page.$('button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Submit"]');
      
      if (submitBtn) {
        logger.info('Found Submit Application button! Clicking...');
        await submitBtn.click();
        await page.waitForTimeout(4000);
        
        logger.info(`Application submitted successfully for job ${job.jobId}!`);
        await prisma.job.update({
          where: { id: jobIdStr },
          data: { status: 'Applied_Auto', unresolvedQuestions: null }
        });
        success = true;
        isFinished = true;
        break;
      } else if (nextBtn) {
        const nextText = await nextBtn.innerText();
        logger.info(`Clicking button to advance: "${nextText}"`);
        await nextBtn.click();
        await page.waitForTimeout(2500);
        currentStep++;
      } else {
        logger.warn('No advance button (Next/Review/Submit) found on current screen.');
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${job.id}.png`);
        await page.screenshot({ path: screenshotPath });
        
        await prisma.job.update({
          where: { id: jobIdStr },
          data: {
            status: 'Requires_Action',
            unresolvedQuestions: JSON.stringify([{
              label: 'Auto-applier got stuck on this step. Please review manually.',
              selector: 'body',
              type: 'text'
            }])
          }
        });
        isFinished = true;
      }
    }
  } catch (error) {
    logger.error(`Error during auto-apply execution for ${job.jobId}`, error);
    await prisma.job.update({
      where: { id: jobIdStr },
      data: { status: 'Failed' }
    });
  } finally {
    await browser.close();
  }

  return success;
}

async function detectFormQuestions(page: Page): Promise<ScreeningQuestionForm[]> {
  const fields: ScreeningQuestionForm[] = [];

  const textContainers = await page.$$('.jobs-easy-apply-form-section__grouping, .fb-dash-form-element');
  for (const container of textContainers) {
    try {
      const labelEl = await container.$('label');
      if (!labelEl) continue;
      const labelText = (await labelEl.innerText()).trim();

      const textInput = await container.$('input[type="text"], textarea');
      const select = await container.$('select');
      const radioInputs = await container.$$('input[type="radio"]');
      const checkbox = await container.$('input[type="checkbox"]');

      if (textInput) {
        const id = await textInput.getAttribute('id');
        fields.push({
          label: labelText,
          selector: `#${id}`,
          type: 'text'
        });
      } else if (select) {
        const id = await select.getAttribute('id');
        const options: string[] = [];
        const optionEls = await select.$$('option');
        for (const opt of optionEls) {
          options.push((await opt.innerText()).trim());
        }
        fields.push({
          label: labelText,
          selector: `#${id}`,
          type: 'select',
          options
        });
      } else if (radioInputs.length > 0) {
        const name = await radioInputs[0].getAttribute('name');
        const options: string[] = [];
        const labels = await container.$$('label');
        for (const lbl of labels) {
          options.push((await lbl.innerText()).trim());
        }
        fields.push({
          label: labelText,
          selector: `input[type="radio"][name="${name}"]`,
          type: 'radio',
          options
        });
      } else if (checkbox) {
        const id = await checkbox.getAttribute('id');
        fields.push({
          label: labelText,
          selector: `#${id}`,
          type: 'checkbox'
        });
      }
    } catch (e) {
      logger.debug('Failed to parse form field element', e);
    }
  }

  return fields;
}

async function attemptFillField(userId: string, page: Page, field: ScreeningQuestionForm): Promise<boolean> {
  const answeredQuestion = await findAnswerUsingAI(userId, field.label, field.options);
  if (!answeredQuestion) return false;

  try {
    if (field.type === 'text') {
      await page.fill(field.selector, answeredQuestion);
      return true;
    } else if (field.type === 'select') {
      const selectEl = await page.$(field.selector);
      if (selectEl) {
        const optionEls = await selectEl.$$('option');
        let matchedVal = '';
        for (const opt of optionEls) {
          const text = await opt.innerText();
          const val = await opt.getAttribute('value') || '';
          if (text.toLowerCase().includes(answeredQuestion.toLowerCase()) || answeredQuestion.toLowerCase().includes(text.toLowerCase())) {
            matchedVal = val;
            break;
          }
        }
        if (matchedVal) {
          await page.selectOption(field.selector, matchedVal);
          return true;
        }
      }
    } else if (field.type === 'radio') {
      const containers = await page.$$('.jobs-easy-apply-form-section__grouping, .fb-dash-form-element');
      for (const container of containers) {
        const label = await container.$('label');
        if (label && (await label.innerText()).includes(field.label)) {
          const radioLabels = await container.$$('label');
          const radioInputs = await container.$$('input[type="radio"]');
          for (let i = 0; i < radioLabels.length; i++) {
            const txt = await radioLabels[i].innerText();
            if (txt.toLowerCase().includes(answeredQuestion.toLowerCase()) || answeredQuestion.toLowerCase().includes(txt.toLowerCase())) {
              await radioInputs[i].click();
              return true;
            }
          }
        }
      }
    } else if (field.type === 'checkbox') {
      const isChecked = answeredQuestion.toLowerCase() === 'yes' || answeredQuestion.toLowerCase() === 'true';
      const checkbox = await page.$(field.selector);
      if (checkbox) {
        const currentlyChecked = await checkbox.isChecked();
        if (isChecked !== currentlyChecked) {
          await checkbox.click();
        }
        return true;
      }
    }
  } catch (err) {
    logger.error(`Error filling field for question: "${field.label}"`, err);
  }

  return false;
}

async function findAnswerUsingAI(userId: string, questionLabel: string, options?: string[]): Promise<string | null> {
  const answeredQuestions = await prisma.screeningQuestion.findMany({
    where: { userId }
  });
  if (answeredQuestions.length === 0) return null;

  let apiKey = config.GEMINI_API_KEY;
  try {
    const keySetting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'gemini_api_key' }
    });
    if (keySetting && keySetting.value) {
      apiKey = decrypt(keySetting.value);
    }
  } catch (e) {
    logger.error('Failed to get Gemini key for auto-apply', e);
  }

  if (!apiKey) {
    const exactMatch = answeredQuestions.find(q => q.questionText.toLowerCase().trim() === questionLabel.toLowerCase().trim());
    if (exactMatch) return exactMatch.answerText;
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are an intelligent form-filling assistant.
We have a list of previously answered questions:
${JSON.stringify(answeredQuestions.map(q => ({ q: q.questionText, a: q.answerText })))}

We are currently filling a form and encountered this new question:
Question Label: "${questionLabel}"
Options (if multiple choice): ${options ? JSON.stringify(options) : 'None'}

Determine if this question is semantically identical or highly similar to any of the previously answered questions.
If it is similar, return the appropriate answer based on the previous answers.
If options are provided, select the option that best fits the matched answer.

Respond ONLY with a JSON object of this structure (no markdown wrappers like \`\`\`json):
{
  "isMatch": boolean,
  "matchedAnswer": string | null
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    let cleanedText = (response.text || '').trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.substring(7);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    cleanedText = cleanedText.trim();

    const res = JSON.parse(cleanedText);
    if (res.isMatch && res.matchedAnswer) {
      logger.info(`AI semantically matched question "${questionLabel}" to answer "${res.matchedAnswer}"`);
      return res.matchedAnswer;
    }
  } catch (err) {
    logger.error('Error during AI screening question matching', err);
  }

  const exactMatch = answeredQuestions.find(q => q.questionText.toLowerCase().trim() === questionLabel.toLowerCase().trim());
  if (exactMatch) return exactMatch.answerText;

  return null;
}
