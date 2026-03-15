import { expect, test } from "@playwright/test";
import { Product } from "../../src/core/types";
import { AmazonRetailer } from "../../src/retailers/amazon";

test.describe("Amazon Retailer Integration", () => {
  let retailer: AmazonRetailer;
  let products: Product[] = [];
  const SEARCH_KEYWORD = "MacBook Pro M5";

  test.beforeAll(async () => {
    test.setTimeout(60000);
    retailer = new AmazonRetailer();
    products = await retailer.getProductList(SEARCH_KEYWORD);
  });

  // Cleanup after all tests (optional but good practice)
  test.afterAll(async () => {
    await retailer.cleanup();
  });

  test("Search results are organic and high-quality", async () => {
    expect(products.length).toBeGreaterThan(0);

    for (const item of products) {
      // 1. Check ASIN Format (Standard 10 chars)
      expect(item.id).toMatch(/^[A-Z0-9]{10}$/);

      // 2. Check for Ad-Filtering (No "Sponsored" competitors)
      const title = item.title.toLowerCase();
      expect(title).not.toContain("asus");
      expect(title).not.toContain("hp 15");
      expect(title).toContain("macbook");

      // 3. Check for Data Completion (Cookie banner handling proof)
      expect(item.title).not.toBe("No title");
      expect(item.price).not.toBeNull();
      expect(item.price).toBeGreaterThan(0); // reasonable min price
      expect(item.price).toBeLessThan(10000); // reasonable max for MacBook
    }
  });

  test("Product detail extraction works for the first result", async () => {
    test.skip(products.length === 0, "No products found to test details.");

    const detail = await retailer.getProduct(products[0].id);

    expect(detail.id).toBe(products[0].id);
    expect(detail.title.toLowerCase()).toContain("macbook");
    expect(detail.images.length).toBeGreaterThan(0);
    expect(detail.images[0]).toContain("media-amazon.com");
  });
});
