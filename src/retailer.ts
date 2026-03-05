import { chromium } from "playwright";

export class AmazonRetailer {
  async getProductList(keywords: string) {
    console.log("getProductList called with:", keywords); // debug: shows it's running

    const browser = await chromium.launch({ headless: false }); // turn true for visible for debugging
    const page = await browser.newPage();

    // Go to search page - encode keywords so spaces work
    await page.goto(
      `https://www.amazon.es/s?k=${encodeURIComponent(keywords)}`,
    );

    // Wait for product grid to load (timeout 15s - prevents hangs)
    await page.waitForSelector("div.s-result-item", { timeout: 15000 });

    // Grab first 5 ASINs - filter out junk (like ads)
    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div.s-result-item"))
        .map((el) => el.getAttribute("data-asin"))
        .filter((asin) => asin && asin.length > 5) // skip empty/invalid
        .slice(0, 5);
    });

    await browser.close();
    return items;
  }
}
