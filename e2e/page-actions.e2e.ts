import { expect, test } from "@playwright/test";
import { safeGoto, safeWaitForSelector } from "../dist/utils/page-actions";

test.describe("Page Action Utils", () => {
  test("safeGoto should retry on failure and eventually throw", async ({
    page,
  }) => {
    let callCount = 0;
    page.goto = async () => {
      callCount++;
      throw new Error("Network Failure");
    };

    await expect(safeGoto(page, "https://test.com", 2)).rejects.toThrow(
      "Network Failure",
    );
    expect(callCount).toBe(2);
  });

  test("safeWaitForSelector should succeed if element appears on second try", async ({
    page,
  }) => {
    let callCount = 0;
    page.waitForSelector = async () => {
      callCount++;
      if (callCount === 1) throw new Error("Timeout");
      return {} as any;
    };

    await expect(safeWaitForSelector(page, ".item", 3)).resolves.not.toThrow();
    expect(callCount).toBe(2);
  });
});
