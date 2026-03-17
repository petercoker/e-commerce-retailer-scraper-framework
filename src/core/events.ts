import { EventEmitter } from "events";
import { Product } from "./types";

/**
 *  Decoupled event system - scraper emits data, piplelines listen.
 *  Keeps everything clean and KISS
 */

export class ScraperEvents extends EventEmitter {
  emitProductList(products: Product[]) {
    this.emit("productList", products);
  }
  emitProductDetail(product: Product) {
    this.emit("productDetail", product);
  }
}

// Singleton so everything retailer uses the same events
export const events = new ScraperEvents();
