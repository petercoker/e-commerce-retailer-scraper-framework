/**
 * Parses a raw price string from e-commerce pages into a normalized number.
 * Handles common formats: €1.829,00 € 1,829.00 $999 £45.50 "No price" etc.
 *
 * @param priceText - Raw price string from DOM
 * @param defaultCurrency - Optional fallback currency (default: "EUR")
 * @returns { price: number | null, currency: string }
 */
export function parsePrice(
  priceText: string | null | undefined,
  defaultCurrency = "EUR"
): { price: number | null; currency: string } {
  if (!priceText || typeof priceText !== "string") {
    return { price: null, currency: defaultCurrency };
  }

  // Normalize: remove spaces, trim
  let clean = priceText.trim().replace(/\s+/g, ""); // remove all spaces

  // Detect currency symbols
  let currency = defaultCurrency;
  const symbols = "€$£¥₹"; // add more if needed

  if (symbols.includes(clean[0])) {
    currency = clean[0];
    clean = clean.slice(1); // remove first char
  } else if (symbols.includes(clean[clean.length - 1])) {
    currency = clean[clean.length - 1];
    clean = clean.slice(0, -1);
  }

  // Handle European vs US number formatting
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");

  if (lastComma > lastDot) {
    // European format (e.g., 1.829,00 or just 15,50)
    // The comma is the decimal. Remove dots (thousands separators) first.
    clean = clean.replace(/\./g, ""); 
    // Now replace the decimal comma with a standard dot
    clean = clean.replace(",", "."); 
  } else {
    // US format (e.g., 1,829.00 or just 15.50)
    // The dot is the decimal. Remove commas (thousands separators).
    clean = clean.replace(/,/g, ""); 
  }

  // Remove any remaining non-numeric chars except dot & minus
  clean = clean.replace(/[^0-9.-]/g, "");

  // convert to number
  const priceNum = parseFloat(clean);

  return {
    price: isNaN(priceNum) ? null : priceNum,
    currency,
  };
}