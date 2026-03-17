import { ScraperCore } from "../../src/core/scraper-core";
import { Product } from "../../src/core/types";
import { BrowserManager } from "../../src/utility/browser-manager";
import {
  mockProductDetail,
  mockProductList,
} from "../fixtures/products.fixture";

// Mock the BrowserManager singleton
jest.mock("../../src/utility/browser-manager", () => {
  const mockCloseBrowser = jest.fn().mockResolvedValue(undefined);
  return {
    BrowserManager: {
      getInstance: jest.fn().mockReturnValue({
        closeBrowser: mockCloseBrowser,
      }),
    },
  };
});

// Create a concrete dummy class to test the abstract parent
class TestAdapter extends ScraperCore {
  async getProductList(keywords: string): Promise<Product[]> {
    return mockProductList;
  }
  async getProduct(id: string): Promise<Product> {
    return mockProductDetail;
  }
}

describe("ScraperCore Abstract Class", () => {
  let scraper: TestAdapter;
  let browserManagerMock: any;

  beforeEach(() => {
    scraper = new TestAdapter();
    browserManagerMock = BrowserManager.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully call cleanup and close the browser", async () => {
    await scraper.cleanup();
    expect(browserManagerMock.closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("should allow concrete classes to implement abstract methods", async () => {
    const list = await scraper.getProductList("laptop");
    const detail = await scraper.getProduct("123");

    expect(list).toHaveLength(2);
    expect(detail.id).toBe("B08N5WRWNW");
  });
});
