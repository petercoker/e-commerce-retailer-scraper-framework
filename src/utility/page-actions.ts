import { Page } from "playwright";

/**
 * Core retry logic with exponential backoff
 */
async function withRetry<T>(
  action: () => Promise<T>,
  label: string,
  retries: number,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await action();
    } catch (error) {
      console.warn(
        `[Retry ${i + 1}/${retries}] ${label} failed: ${(error as Error).message}`,
      );
      if (i === retries - 1) throw error;
      // Using page.waitForTimeout is cleaner if you have access to page, 
      // but a standard setTimeout works fine here.
      await new Promise((res) => setTimeout(res, 2000 * (i + 1))); 
    }
  }
  throw new Error(`${label} failed after ${retries} retries`);
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