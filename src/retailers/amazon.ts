import { AMAZON_BASE_URL } from "../core/constants";
import { Product } from "../core/types";
import { BrowserManager } from "../utility/browser-manager";
import { safeGoto, safeWaitForSelector } from "../utility/page-actions";
import { parsePrice } from "../utility/utils";

/**
 * Main scraper class for Amazon.es.
 * Uses shared browser instance (via BrowserManager) to avoid repeated launches.
 */
export class AmazonRetailer {
  private browserManager = BrowserManager.getInstance();

  /**
   * Search Amazon and return list of products with asin, title, price.
   * @param keywords - Search term (e.g., "MacBook Pro M5")
   * @param page - Optional existing page to reuse (avoids opening/closing)
   * @returns Array of product items (max 5)
   */
  async getProductList(
    keywords: string,
    page?: import("playwright").Page,
  ): Promise<Product[]> {
    console.log(`Searching for: ${keywords}`);

    const existingPage = page !== undefined;
    const targetPage = page ?? (await this.browserManager.newPage());

    try {
      const url = `${AMAZON_BASE_URL}/s?k=${encodeURIComponent(keywords)}`;
      await safeGoto(targetPage, url);

      // --- 1. HANDLE COOKIES ---
      // We look for the "Accept" button and click it if it exists to clear the overlay
      try {
        const acceptCookies = await targetPage.waitForSelector(
          "#sp-cc-accept",
          { timeout: 3000 },
        );
        if (acceptCookies) await acceptCookies.click();
      } catch (e) {
        // If it's not there, just continue
      }

      // --- 2. WAIT FOR ORGANIC RESULTS ---
      // We specifically wait for search results that are NOT ads
      await safeWaitForSelector(
        targetPage,
        "div[data-component-type='s-search-result']:not(.AdHolder)",
        3,
      );

      // 1. Get raw data from browser (only DOM stuff)
      const rawItems = await targetPage.evaluate(() => {
        const items: { asin: string; title: string; priceText: string }[] = [];

        const nodes = document.querySelectorAll(
          "div[data-component-type='s-search-result']",
        );

        for (const node of Array.from(nodes)) {
          // Skip sponsored/ad items
          if (
            node.classList.contains("AdHolder") ||
            node.querySelector(".s-sponsored-label-text")
          ) {
            continue;
          }

          const asin = node.getAttribute("data-asin");
          if (!asin || asin.length < 5) continue;

          const titleEl = node.querySelector(
            "h2 span.a-size-medium, h2 a span, .a-size-base-plus, span.a-text-normal",
          );
          const title = titleEl?.textContent?.trim() || "No title";

          const priceEl = node.querySelector(".a-price .a-offscreen");
          const priceText = priceEl?.textContent?.trim() || "No price";

          items.push({ asin, title, priceText });

          if (items.length >= 5) break;
        }

        return items;
      });

      // 2. Parse prices **in Node.js** (no browser context needed)
      return rawItems.map((item) => {
        const { price, currency } = parsePrice(item.priceText);

        return {
          retailer: "amazon",
          id: item.asin,
          url: "", // can fill later if needed
          title: item.title,
          price,
          currency,
          images: [],
          availability: "unknown",
          metadata: {},
        } satisfies Product;
      });
    } catch (error) {
      // Take a screenshot if it fails so you can see if you got hit by a CAPTCHA
      await targetPage.screenshot({ path: `error-search-${Date.now()}.png` });
      throw new Error(
        `Failed to get product list: ${(error as Error).message}`,
      );
    } finally {
      // Only close the page if we created it (not reusing an existing page)
      if (!existingPage) {
        await targetPage.close();
      }
    }
  }

  /**
   * Fetch full details for a single product by ASIN.
   * @param asin - Amazon product ID (e.g. "B0DLHH2QR6")
   * @param page - Optional existing page to reuse (avoids opening/closing)
   * @returns Product details (asin, title, price, images)
   */
  async getProduct(
    asin: string,
    page?: import("playwright").Page,
  ): Promise<Product> {
    console.log(`Fetching product: ${asin}`);

    const existingPage = page !== undefined;
    const targetPage = page ?? (await this.browserManager.newPage());

    try {
      const url = `${AMAZON_BASE_URL}/dp/${asin}`;
      // Updated to use the utility
      await safeGoto(targetPage, url);
      await safeWaitForSelector(targetPage, "#productTitle", 3);

      const rawDetail = await targetPage.evaluate((productAsin) => {
        const title =
          document.querySelector("#productTitle")?.textContent?.trim() ||
          "No title found";

        const priceEl =
          document.querySelector(".a-price .a-offscreen") ||
          document.querySelector("#price_inside_buybox") ||
          document.querySelector(".a-price-whole");

        const priceText = priceEl?.textContent?.trim() || "No price";

        const images = Array.from(
          document.querySelectorAll(
            "#landingImage, #imgTagWrapperId img, #altImages img",
          ),
        )
          .map((img) => (img as HTMLImageElement).src)
          .filter(Boolean)
          .slice(0, 5);

        return { productAsin, title, priceText, images };
      }, asin);

      // Parse price **in Node.js** after evaluation
      const { price, currency } = parsePrice(rawDetail.priceText);

      return {
        retailer: "amazon",
        id: rawDetail.productAsin,
        url: targetPage.url(),
        title: rawDetail.title,
        price,
        currency,
        images: rawDetail.images,
        availability: "unknown",
        metadata: {},
      };
    } finally {
      if (!existingPage) {
        await targetPage.close();
      }
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