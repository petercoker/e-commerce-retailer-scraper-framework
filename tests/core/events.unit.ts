import { ScraperEvents } from "../../src/core/events";
import {
  mockProductDetail,
  mockProductList,
} from "../fixtures/products.fixture";

describe("ScraperEvents", () => {
  let scraperEvents: ScraperEvents;

  beforeEach(() => {
    scraperEvents = new ScraperEvents();
  });

  it("should emit 'productList' with an array of products", () => {
    const mockListener = jest.fn();
    scraperEvents.on("productList", mockListener);

    scraperEvents.emitProductList(mockProductList);

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(mockProductList);
  });

  it("should emit 'productDetail' with a single product", () => {
    const mockListener = jest.fn();
    scraperEvents.on("productDetail", mockListener);

    scraperEvents.emitProductDetail(mockProductDetail);

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(mockProductDetail);
  });

  it("should use the singleton 'events' instance correctly", () => {
    const mockListener = jest.fn();
    scraperEvents.on("productList", mockListener);

    scraperEvents.emitProductList(mockProductList);

    expect(mockListener).toHaveBeenCalledWith(mockProductList);
  });
});
