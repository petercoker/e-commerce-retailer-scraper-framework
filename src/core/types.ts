/**
 * Unified product schema for all retailers.
 * All adapters must map their data to this shape.
 */
export interface Product {
  retailer: string; // e.g. "amazon", "ebay", "aliexpress"
  id: string; // platform-specific ID (asin, itemId, etc.)
  url: string;
  title: string;
  price: number | null; // normalized number (no currency symbol)
  currency: string; // ISO code: "EUR", "USD", etc.
  images: string[]; // array of image URLs
  rating?: number; // 0–5 or 0–10 scale
  reviewCount?: number;
  availability: "in_stock" | "out_of_stock" | "unknown" | "preorder";
  category?: string;
  metadata: Record<string, any>; // retailer-specific fields (seller, specs, shipping, etc.)
}