import * as dotenv from "dotenv";
import { AmazonRetailer } from "./retailers/amazon";

// Load .env configs
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const keywords = args.length === 0 ? "MacBook Pro" : args.join(" ");

  const retailer = new AmazonRetailer();

  try {
    console.log(`\n=== Amazon.es Scraper CLI ===`);
    console.log(`Searching for: "${keywords}"\n`);

    // The retailer uses the Singleton BrowserManager internally
    const list = await retailer.getProductList(keywords);
    console.log(`Found ${list.length} products.`);

    if (list.length > 0) {
      const firstAsin = list[0].id;
      console.log(`\nFetching details for: ${firstAsin}...`);

      const detail = await retailer.getProduct(firstAsin);
      console.log(`Product Details:`, JSON.stringify(detail, null, 2));
    }
  } catch (error) {
    console.error("\nCLI Error:", (error as Error).message);
  } finally {
    console.log("\nCleaning up...");
    // This closes the shared browser instance once everything is done
    await retailer.cleanup();
  }
}

main();
