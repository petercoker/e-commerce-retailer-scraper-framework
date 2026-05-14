/**
 * Test script to verify proxy configuration
 *
 * Usage:
 *   npx ts-node test-proxy.ts
 *
 * Prerequisites:
 *   1. Set PROXY_ACCOUNT_SLUG in .env file
 *   2. Optionally set PROXY_REGION in .env file
 */

import { BrowserManager } from './src/utility/browser-manager';

async function testProxy() {
  console.log('=== Testing Proxy Configuration ===\n');

  const browserManager = BrowserManager.getInstance();

  try {
    console.log('Launching browser with proxy configuration...');
    const page = await browserManager.newPage();

    console.log('Browser launched successfully!');
    console.log('Navigating to httpbin.org to check IP...');

    await page.goto('https://httpbin.org/ip');
    const content = await page.textContent('body');

    console.log('\n=== Response ===');
    console.log(content);

    console.log('\n✅ Proxy test completed successfully!');
  } catch (error) {
    console.error('\n❌ Proxy test failed:');
    console.error((error as Error).message);
  } finally {
    await browserManager.closeBrowser();
  }
}

testProxy().catch(console.error);