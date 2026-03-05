import { expect, test } from "@playwright/test";
import { AmazonRetailer } from "../src/retailer";

// Shared retailer instance (created once per describe block)
let retailer: AmazonRetailer;
let validAsin: string; // cached ASIN so we don't re-scrape list every time

test.beforeAll(async () => {
  retailer = new AmazonRetailer();

  // Run once before all tests in this file — get one valid ASIN
  const list = await retailer.getProductList("MacBook Pro M5");
  expect(list.length).toBeGreaterThan(0);

  validAsin = list[0].asin;
});

test.describe("Product List Functionality", () => {
  test("getProductList returns a non-empty list of products", async () => {
    const list = await retailer.getProductList("MacBook Pro M5");

    expect(list.length).toBeGreaterThan(0);
    expect(Array.isArray(list)).toBe(true);

    const first = list[0];
    expect(first).toHaveProperty("asin");
    expect(typeof first.asin).toBe("string");
    expect(first.asin.length).toBeGreaterThan(5);
  });

  test("getProductList returns items with title and price", async () => {
    const list = await retailer.getProductList("MacBook Pro M5");

    const first = list[0];
    expect(first).toHaveProperty("title");
    expect(typeof first.title).toBe("string");
    expect(first.title.length).toBeGreaterThan(10);
    expect(first.title).not.toContain("No title");

    expect(first).toHaveProperty("price");
    expect(typeof first.price).toBe("string");
    expect(first.price.length).toBeGreaterThan(3);
    expect(first.price).not.toContain("No price");
  });
});

test.describe("Individual Product Details", () => {
  test("getProduct returns full details for a real product", async () => {
    // Use cached valid ASIN from beforeAll — no repeated getProductList call
    const detail = await retailer.getProduct(validAsin);

    expect(detail).toBeDefined();
    expect(detail).toHaveProperty("asin");
    expect(detail.asin).toBe(validAsin);

    expect(detail).toHaveProperty("title");
    expect(detail.title).toBeTruthy();
    expect(detail.title.length).toBeGreaterThan(10);

    expect(detail).toHaveProperty("price");
    expect(detail.price).toBeTruthy();

    expect(detail).toHaveProperty("images");
    expect(Array.isArray(detail.images)).toBe(true);
    expect(detail.images.length).toBeGreaterThan(0);
  });
});

// Cleanup after all tests (optional but good practice)
test.afterAll(async () => {
  await retailer.cleanup();
});
