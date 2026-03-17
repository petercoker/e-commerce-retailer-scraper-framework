# E-Commerce Retailer Scraper Framework

A clean, extensible, TDD-built Node.js + TypeScript + Playwright scraper for Amazon.es — designed to move offline market research online and easily extendable to other sites (eBay, AliExpress, Mercadona, PcComponentes, etc.).

#  Project Structure 
src/
- core/          = shared (ScraperCore, types, events, retry)
- retailers/     = one adapter per site (amazon.ts, ebay.ts...)
- pipelines/     = JSON + CSV (decoupled output)
- utils/         = parsePrice, safeGoto, BrowserManager
- cli.ts         = simple terminal runner

## Features

- `getProductList(keywords)` — returns top 5 organic products (id, title, price, currency)
- `getProduct(id)` — returns full product details (id, title, price, currency, images, etc.)
- Reusable singleton browser (BrowserManager — launches once)
- Decoupled output pipelines (JSON + CSV export via events)
- Retry logic with exponential backoff
- Random delays to mimic human behavior
- Cookie banner handling
- Ready for new retailers (one adapter file per site)

## Quick Start

```bash
npm install
npx playwright install chromium
npm run demo          # or npm run demo "wireless earbuds"
```
