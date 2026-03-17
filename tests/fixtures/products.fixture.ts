import { Product } from "../../src/core/types";

export const mockProductDetail: Product = {
  retailer: "Amazon",
  id: "B08N5WRWNW",
  title: 'Apple MacBook Air "M1" chip',
  price: 999.0,
  currency: "$",
  url: "",
  images: [],
  availability: "in_stock",
  metadata: {},
};

export const mockProductList: Product[] = [
  mockProductDetail,
  {
    retailer: "eBay",
    id: "124567890",
    title: "Sony PlayStation 5",
    price: 499.99,
    currency: "$",
    url: "",
    images: [],
    availability: "in_stock",
    metadata: {},
  },
];
