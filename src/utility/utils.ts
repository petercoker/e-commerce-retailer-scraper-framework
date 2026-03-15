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

  // Detect currency symbols (expandable, very simple — looks at start or end)
  let currency = defaultCurrency;
  const symbols = "€$£¥₹"; // add more if needed

  if (symbols.includes(clean[0])) {
    currency = clean[0];
    clean = clean.slice(1); // remove first char
  } else if (symbols.includes(clean[clean.length - 1])) {
    currency = clean[clean.length - 1];
    clean = clean.slice(0, -1); // remove last char
  }

  // Replace comma with dot, to make it a number (European comma → dot)
  clean = clean.replace(",", ".");

  // Remove any remaining non-numeric chars except dot & minus
  clean = clean.replace(/[^0-9.-]/g, "");

  // convert to number
  const priceNum = parseFloat(clean);

  return {
    price: isNaN(priceNum) ? null : priceNum,
    currency,
  };
}

