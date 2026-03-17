import { AMAZON_ES_BASE_URL } from "../core/constants";
import { events } from "../core/events";
import { ScraperCore } from "../core/scraper-core";
import { Product } from "../core/types";
import {
  safeGoto,
  safeWaitForSelector,
  withRetry,
} from "../utility/page-actions";
import { parsePrice } from "../utility/utils";

/**
 * Amazon.es Adapter
 * Extends the core framework and implements Amazon-specific scraping logic.
 */
export class AmazonAdapter extends ScraperCore {
  async getProductList(
    keywords: string,
    page?: import("playwright").Page,
  ): Promise<Product[]> {
    console.log(`Searching for: ${keywords}`);

    const existingPage = page !== undefined;
    const targetPage = page ?? (await this.browserManager.newPage());

    try {
      // Delay 1: before first navigation (think like typing search)
      await this.randomDelay(1200, 3500);

      const url = `${AMAZON_ES_BASE_URL}/s?k=${encodeURIComponent(keywords)}`;
      await withRetry(
        () => safeGoto(targetPage, url),
        "Navigate to search page",
        3,
      );

      // Delay 2: after page load, before cookie click (page settling)
      await this.randomDelay(800, 2500);

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

      // Delay 3: after cookies, before waiting for results
      await this.randomDelay(1000, 3000);

      // --- 2. WAIT FOR ORGANIC RESULTS ---
      // We specifically wait for search results that are NOT ads
      await withRetry(
        () =>
          safeWaitForSelector(
            targetPage,
            "div[data-component-type='s-search-result']:not(.AdHolder)",
            3,
          ),
        "Wait for search results",
        3,
      );

      // 1. Get raw data from browser
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

      // 2. Parse prices in Node.js (outside evaluate)
      const list = rawItems.map((item) => {
        const { price, currency } = parsePrice(item.priceText);
        return {
          retailer: "amazon",
          id: item.asin,
          url: "",
          title: item.title,
          price,
          currency,
          images: [],
          availability: "unknown",
          metadata: {},
        } satisfies Product;
      });

      // Delay 4: before returning (breathing room)
      await this.randomDelay(500, 1500);

      // Emit the data so pipelines can save it
      events.emitProductList(list);
      return list;
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
  async getProduct(
    asin: string,
    page?: import("playwright").Page,
  ): Promise<Product> {
    console.log(`Fetching product: ${asin}`);

    const existingPage = page !== undefined;
    const targetPage = page ?? (await this.browserManager.newPage());

    try {
      // Delay 1: before navigation
      await this.randomDelay(1200, 3500);

      const url = `${AMAZON_ES_BASE_URL}/dp/${asin}`;

      await withRetry(
        () => safeGoto(targetPage, url),
        "Navigate to product page",
        3,
      );

      // Delay 2: after load
      await this.randomDelay(1000, 3000);

      await withRetry(
        () => safeWaitForSelector(targetPage, "#productTitle", 3),
        "Wait for product title",
        3,
      );

      // 1. Get raw data from browser
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
          document.querySelectorAll("#landingImage, #imgTagWrapperId img"),
        )
          .map((img) => (img as HTMLImageElement).src)
          .slice(0, 5);

        return { productAsin, title, priceText, images };
      }, asin);

      // 2. Parse price in Node.js
      const { price, currency } = parsePrice(rawDetail.priceText);
      const product = {
        retailer: "amazon",
        id: rawDetail.productAsin,
        url: targetPage.url(),
        title: rawDetail.title,
        price,
        currency,
        images: rawDetail.images,
        availability: "unknown",
        metadata: {},
      } satisfies Product;

      // Delay 3: before returning
      await this.randomDelay(500, 1500);

      // Emit the data so pipelines can save it
      events.emitProductDetail(product);
      return product;
    } finally {
      if (!existingPage) await targetPage.close();
    }
  }

  async cleanup(): Promise<void> {
    await this.browserManager.closeBrowser();
  }
}
