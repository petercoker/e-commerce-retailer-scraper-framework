import { expect, test } from "@playwright/test";
import { BrowserManager } from "../../src/utility/browser-manager";

test.describe("BrowserManager", () => {
  let manager: BrowserManager;

  test.beforeEach(() => {
    // Reset singleton between tests (for isolation)
    (BrowserManager as any).instance = null;
    manager = BrowserManager.getInstance();
  });

  test.afterEach(async () => {
    await manager.closeBrowser();
  });

  test("launches browser only once (singleton reuse)", async () => {
    const browser1 = await manager.getBrowser();
    const browser2 = await manager.getBrowser();

    expect(browser1).toBe(browser2); // same instance
  });

  test("creates new pages with correct user-agent", async () => {
    const page = await manager.newPage();

    const userAgent = await page.evaluate(() => navigator.userAgent);
    expect(userAgent).toContain("Mozilla/5.0");
    expect(userAgent).toContain("Chrome");

    await page.close();
  });

  test("closes browser properly and can relaunch", async () => {
    const browser1 = await manager.getBrowser();
    await manager.closeBrowser();

    const browser2 = await manager.getBrowser();
    expect(browser2).not.toBe(browser1); // new instance after close
  });
});
