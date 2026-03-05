import { ProductDetail, ProductListItem } from "./types";
import { BrowserManager } from "./utils/browser";

/**
 * Main scraper class for Amazon.es.
 * Uses shared browser instance (via BrowserManager) to avoid repeated launches.
 */
export class AmazonRetailer {
  private browserManager = BrowserManager.getInstance();

  /**
   * Search Amazon and return list of products with asin, title, price.
   * @param keywords - Search term (e.g., "MacBook Pro M5")
   * @returns Array of product items (max 5)
   */
  async getProductList(keywords: string): Promise<ProductListItem[]> {
    console.log(`Searching for: ${keywords}`);

    const page = await this.browserManager.newPage();

    try {
      await page.goto(
        `https://www.amazon.es/s?k=${encodeURIComponent(keywords)}`,
        {
          waitUntil: "domcontentloaded",
        },
      );

      await page.waitForSelector("div.s-result-item", { timeout: 15000 });

      const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("div.s-result-item"))
          .map((el) => {
            const asin = el.getAttribute("data-asin");
            if (!asin || asin.length <= 5) return null;

            // Title fallback selectors (Amazon layout changes often)
            const titleEl =
              el.querySelector("h2 span.a-size-medium") ||
              el.querySelector("h2 a span") ||
              el.querySelector("h2");

            const title = titleEl ? titleEl.textContent?.trim() : "No title";

            // Clean price (hidden but reliable)
            const priceEl = el.querySelector(".a-price .a-offscreen");
            const price = priceEl ? priceEl.textContent?.trim() : "No price";

            return { asin, title, price };
          })
          .filter((item): item is ProductListItem => item !== null)
          .slice(0, 5);
      });

      return items;
    } finally {
      await page.close(); // Always close page, keep browser alive
    }
  }

  /**
   * Fetch full details for a single product by ASIN.
   * @param asin - Amazon product ID (e.g. "B0DLHH2QR6")
   * @returns Product details (asin, title, price, images)
   */
  async getProduct(asin: string): Promise<ProductDetail> {
    console.log(`Fetching product: ${asin}`);

    const page = await this.browserManager.newPage();

    try {
      await page.goto(`https://www.amazon.es/dp/${asin}`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector("#productTitle", { timeout: 15000 });

      const detail = await page.evaluate((productAsin) => {
        const title =
          document.querySelector("#productTitle")?.textContent?.trim() ||
          document.querySelector("h1 span")?.textContent?.trim() ||
          "No title found";

        const priceEl =
          document.querySelector(".a-price .a-offscreen") ||
          document.querySelector("span.a-offscreen");
        const price = priceEl?.textContent?.trim() || "No price";

        const images = Array.from(
          document.querySelectorAll(
            "#landingImage, #imgTagWrapperId img, #altImages img",
          ),
        )
          .map((img) => (img as HTMLImageElement).src)
          .filter(Boolean)
          .slice(0, 5);

        return { asin: productAsin, title, price, images };
      }, asin);

      return detail;
    } finally {
      await page.close();
    }
  }

  /**
   * Clean up shared browser when application ends.
   * Call this once when your script finishes.
   */
  async cleanup(): Promise<void> {
    await this.browserManager.closeBrowser();
  }
}
