import fs from "fs/promises";
import { Product } from "../core/types";

/**
 * Simple JSON pipleline - saves everything to a file
 */
export async function saveToJson(
  products: Product[],
  filename = "products.json",
) {
  await fs.writeFile(filename, JSON.stringify(products, null, 2));
  console.log(`Saved ${products.length} products to ${filename}`);
}

/**
 * Escape any value for safe CSV usage:
 * - null/undefined → empty string
 * - double quotes → doubled (" → "")
 * - wrap everything in quotes
 */
function csvEscape(value: any): string {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Simple CSV pipeline – saves products to a clean, Excel-compatible file
 */
export async function saveToCsv(
  products: Product[],
  filename = "products.csv"
): Promise<void> {
  if (products.length === 0) {
    console.log("No products to save to CSV");
    return;
  }

  // Header
  const header = "retailer,id,title,price,currency\n";

  // Rows – every field properly escaped
  const rows = products
    .map((p) =>
      [
        csvEscape(p.retailer),
        csvEscape(p.id),
        csvEscape(p.title),
        csvEscape(p.price ?? ""),
        csvEscape(p.currency ?? ""),
      ].join(",")
    )
    .join("\n");

  const csvContent = header + rows;

  await fs.writeFile(filename, csvContent, "utf-8");
  console.log(`Saved ${products.length} products to ${filename}`);
}