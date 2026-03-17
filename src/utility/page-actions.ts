import { Page } from "playwright";

/**
 * Retry a function with exponential backoff
 * @param fn - async function to retry
 * @param label - name for logging
 * @param maxRetries - default 3
 * @param baseDelayMs - starting delay (doubles each retry)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[Retry ${attempt}/${maxRetries}] ${label} failed: ${(err as Error).message}`);
      if (attempt === maxRetries) throw err;

      // Exponential backoff + jitter
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Retrying after ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`${label} failed after ${maxRetries} retries`);
}

export async function safeGoto(
  page: Page,
  url: string,
  retries = 3,
): Promise<void> {
  // We wrap the call so it returns Promise<void> instead of Promise<Response | null>
  await withRetry(
    async () => { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }); },
    `Navigation to ${url}`,
    retries,
  );
}

export async function safeWaitForSelector(
  page: Page,
  selector: string,
  retries = 3,
): Promise<void> {
  // We wrap the call so it returns Promise<void> instead of Promise<ElementHandle | null>
  await withRetry(
    async () => { await page.waitForSelector(selector, { timeout: 10000 }); },
    `Selector '${selector}'`,
    retries,
  );
}