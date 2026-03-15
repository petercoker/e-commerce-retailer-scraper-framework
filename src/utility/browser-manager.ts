import * as dotenv from "dotenv";
import { Browser, chromium, Page } from "playwright";

// Load environment variables from .env file
dotenv.config();

/**
 * Singleton manager for Playwright browser instance.
 * - Launches browser only once
 * - Reuses it across all scraper calls
 * - Provides clean page creation with anti-bot headers
 * - Safe cleanup when done
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;

  // Private constructor, forces use of getInstance()
  private constructor() {}

  /**
   * Get the single instance (singleton patten)
   * Ensures only one BrowswerManager exists
   */
  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Get or lazily create the shared browser instance
   * - Launches browser only the first time
   * - Keeps it alive for reuse
   */
  public async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      // Default to true if not explicitly set to "false"
      const isHeadless = process.env.HEADLESS !== "false";

      this.browser = await chromium.launch({
        headless: isHeadless,
      });
    }
    return this.browser;
  }

  /**
   * Create a new page with anti-bot headers
   * - Reuses the shared browser
   * - Sets a realistic User-Agent to avoid detection
   */
  public async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Realistic User-Agent - makes scraper look like a normal browser
    await page.setExtraHTTPHeaders({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    });

    return page;
  }

  /**
   * Gracefully closeBrowser the browser when finished
   * - Should be called at the end of the script or in cleanup
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
