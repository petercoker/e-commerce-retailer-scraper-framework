import fs from "fs/promises";
import { saveToJson, saveToCsv } from "../../src/pipelines";
import {
  mockProductList,
} from "../fixtures/products.fixture";

// Mock the filesystem module
jest.mock("fs/promises");

describe("Pipeline outputs", () => {
  // Suppress console.log in tests to keep the output clean
  beforeAll(() => jest.spyOn(console, "log").mockImplementation(() => {}));
  afterAll(() => jest.restoreAllMocks());
  afterEach(() => jest.clearAllMocks());

  describe("saveToJson", () => {
    it("should write products to a JSON file", async () => {
      await saveToJson(mockProductList, "test.json");

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        "test.json",
        JSON.stringify(mockProductList, null, 2)
      );
    });
  });

  describe("saveToCsv", () => {
    it("should write products to a CSV file with correct headers and formatting", async () => {
      await saveToCsv(mockProductList, "test.csv");

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // Extract the arguments passed to fs.writeFile
      const [filename, fileContent] = (fs.writeFile as jest.Mock).mock.calls[0];
      
      expect(filename).toBe("test.csv");
      expect(fileContent).toContain("retailer,id,title,price,currency\n");
      expect(fileContent).toContain('"Amazon",'); // Check if data is mapped
      expect(fileContent).toContain('""M1""'); // Check if quotes were escaped
    });
  });
});