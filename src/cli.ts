import { events } from "./core/events";
import { saveToCsv, saveToJson } from "./pipelines";
import { AmazonAdapter } from "./retailers/amazon";

async function main() {
  const keywords = process.argv.slice(2).join(" ") || "MacBook Pro M5";

  console.log(`\n=== Amazon.es Scraper ===`);
  console.log(`Searching for: "${keywords}"\n`);

  const retailer = new AmazonAdapter();

  // Decoupled pipelines - automatically save when data arrives
  events.on("productList", async (products) => {
    await saveToJson(products, `amazon-${keywords.replace(/\s+/g, "-")}.json`);
    await saveToCsv(products, `amazon-${keywords.replace(/\s+/g, "-")}.csv`);
  });

  try {
    const list = await retailer.getProductList(keywords);

    console.log(`Found ${list.length} products!`);

    if (list.length > 0) {
      const detail = await retailer.getProduct(list[0].id);
      console.log(
        `Product Details fetced for:`,
        JSON.stringify(detail, null, 2),
      );
    }
  } catch (error) {
    console.error("\nCLI Error:", (error as Error).message);
  } finally {
    await retailer.cleanup();
    console.log("\nBrowser closed. Done!");
  }
}

main();
