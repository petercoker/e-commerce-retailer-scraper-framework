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

## Proxy Configuration

This framework uses the Shalion Proxy library for proxy connections. The proxy helps avoid rate limiting and bot detection.

### Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure your proxy account:**
   Set the `PROXY_ACCOUNT_SLUG` environment variable in `.env`:
   ```bash
   PROXY_ACCOUNT_SLUG=brightdata-datacenter
   ```

3. **Optional: Specify a region:**
   ```bash
   PROXY_REGION=es  # Optional: use proxy from specific region
   ```

### Supported Proxy Providers

- **Brightdata** - Datacenter and residential proxies
- **Oxylabs** - Datacenter and residential proxies with e-commerce scraper API

For local testing, you need to set the `PROXY_ACCOUNT_SLUG` environment variable which will automatically be used to connect to the correct proxy. A slug is a unique identifier following the pattern: lowercase, no white spaces, separated by hyphen.

For example:
- Brightdata Datacenter: `brightdata-datacenter`
- Oxylabs Ecommerce Scraper API - Amazon - Not Rendered: `oxylabs-ecommerce-scraper-api-amazon-not-rendered`

### Proxy Usage in Code

The `BrowserManager` automatically configures the proxy when launching the browser:

```typescript
// The proxy is automatically configured from environment variables
const browserManager = BrowserManager.getInstance();
const page = await browserManager.newPage();
// Page will use the configured proxy
```

For more advanced proxy usage, see the [Proxy documentation](https://www.notion.so/Proxy-fff56175e181812bb466f972b447dcd9).
