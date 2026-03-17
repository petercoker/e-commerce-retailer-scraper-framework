import { parsePrice } from "../../src/utility/utils";

describe("parsePrice", () => {
  it("should parse a standard US price", () => {
    expect(parsePrice("$999")).toEqual({ price: 999, currency: "$" });
  });

  it("should parse a UK price with decimals", () => {
    expect(parsePrice("£45.50")).toEqual({ price: 45.5, currency: "£" });
  });

  it("should parse a price where the symbol is at the end", () => {
    expect(parsePrice("1500€")).toEqual({ price: 1500, currency: "€" });
  });

  it("should remove extra spaces", () => {
    expect(parsePrice(" €   120.50 ")).toEqual({ price: 120.5, currency: "€" });
  });

  it("should handle 'No price' or invalid strings gracefully", () => {
    expect(parsePrice("No price")).toEqual({ price: null, currency: "EUR" });
    expect(parsePrice("Contact for price", "USD")).toEqual({
      price: null,
      currency: "USD",
    });
  });

  it("should handle null or undefined inputs", () => {
    expect(parsePrice(null)).toEqual({ price: null, currency: "EUR" });
    expect(parsePrice(undefined, "USD")).toEqual({
      price: null,
      currency: "USD",
    });
  });

  /** * NOTE: This test might currently fail based on your code's handling
   * of the thousands separator. It is written to expect the *correct* behavior.
   */
  it("should parse European formatted strings", () => {
    // Expecting 1829.00
    expect(parsePrice("€1.829,00")).toEqual({ price: 1829.0, currency: "€" });
  });
});


