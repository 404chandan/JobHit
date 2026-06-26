import { chromium, Browser, BrowserContext } from 'playwright';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';
import { decrypt } from './crypto';

const prisma = new PrismaClient();

export async function getSavedCookies(userId: string): Promise<any[]> {
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: { userId, key: 'linkedin_cookies' }
    });
    if (setting && setting.value) {
      const decrypted = decrypt(setting.value);
      return JSON.parse(decrypted);
    }
  } catch (error) {
    logger.error(`Failed to get cookies from DB for user ${userId}`, error);
  }
  return [];
}

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
}

export async function launchBrowser(userId: string, headless = true, loadCookies = true): Promise<BrowserSession> {
  logger.info(`Launching browser for user ${userId} (headless: ${headless}, loadCookies: ${loadCookies})...`);
  
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const cookies = loadCookies ? await getSavedCookies(userId) : [];
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  if (cookies.length > 0) {
    logger.info(`Injecting ${cookies.length} session cookies into browser context`);
    await context.addCookies(cookies);
  } else {
    logger.warn('No cookies injected. Scraper will run anonymously.');
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return { browser, context };
}
