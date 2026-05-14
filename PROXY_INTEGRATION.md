# Proxy Integration Guide

This document explains how to use the proxy functionality from the Shalion javascript-commons library.

## Overview

The e-commerce retailer scraper framework now includes proxy support to help avoid rate limiting and bot detection when scraping websites. The proxy is automatically configured when launching the browser.

## Setup

### 1. Environment Variables

Create a `.env` file in your project root (or copy from `.env.example`):

```bash
# Browser Configuration
HEADLESS=false

# Proxy Configuration
PROXY_ACCOUNT_SLUG=your-proxy-account-slug
PROXY_REGION=us  # Optional: specify region (e.g., us, es, br)
```

### 2. Proxy Account Slugs

Proxy accounts follow a specific naming pattern (slug format):
- lowercase
- no white spaces
- separated by hyphens

Examples:
- `brightdata-datacenter`
- `oxylabs-ecommerce-scraper-api-amazon-not-rendered`
- `nimble`

## Usage

### Automatic Proxy Configuration

The `BrowserManager` automatically configures the proxy when launching the browser. No code changes are needed:

```typescript
import { BrowserManager } from './src/utility/browser-manager';

const browserManager = BrowserManager.getInstance();
const page = await browserManager.newPage();

// Page will use the configured proxy from environment variables
await page.goto('https://example.com');
```

### Testing Proxy Connection

Run the test script to verify your proxy configuration:

```bash
npm run test:proxy
```

This will:
1. Launch a browser with proxy configuration
2. Navigate to httpbin.org to check your IP
3. Display the IP address (should be different from your actual IP if proxy is working)

### Using Proxy in Scrapers

The proxy is automatically used in all scrapers that extend `ScraperCore`:

```typescript
import { AmazonAdapter } from './src/retailers/amazon';

const retailer = new AmazonAdapter();

// Proxy is automatically used
const products = await retailer.getProductList('MacBook Pro');
```

## Supported Proxy Providers

The proxy library supports multiple providers:

- **Brightdata**: Datacenter and residential proxies
- **Oxylabs**: Datacenter, residential, and e-commerce scraper APIs
- **Nimble**: Web scraping APIs
- **ScraperAPI**: Web scraping service

## How It Works

1. **Configuration Loading**: The `buildProxy()` function reads the `PROXY_ACCOUNT_SLUG` environment variable
2. **Account Retrieval**: Fetches proxy account details from the Shalion API or cache
3. **Region Selection**: If `PROXY_REGION` is set, validates and applies the region
4. **Browser Launch**: The `BrowserManager` passes proxy configuration to Playwright
5. **Request Routing**: All browser requests are routed through the proxy server

## Architecture

```
Environment Variables
(PROXY_ACCOUNT_SLUG, PROXY_REGION)
        ↓
BrowserManager.getBrowser()
        ↓
buildProxy(region)
        ↓
Proxy Account API / Cache
        ↓
Proxy Instance (Brightdata/Oxylabs/Nimble/ScraperAPI)
        ↓
Playwright Browser Launch
        ↓
All requests use proxy
```

## Troubleshooting

### Proxy Not Working

1. **Check environment variables**:
   ```bash
   echo $PROXY_ACCOUNT_SLUG
   echo $PROXY_REGION
   ```

2. **Verify proxy account is active**: The proxy account must be marked as active in the Shalion system

3. **Check region support**: If using `PROXY_REGION`, ensure the region is supported by your proxy account

### Proxy Connection Errors

If you see connection errors:
- Verify your proxy account credentials are correct
- Check if your proxy account has sufficient bandwidth/requests available
- Ensure the proxy account is not expired

### TypeScript Compilation Errors

If you see TypeScript errors related to javascript-commons:
```bash
# Install required dependencies
npm install
```

## Additional Resources

- [Proxy Documentation](https://www.notion.so/Proxy-fff56175e181812bb466f972b447dcd9)
- [Proxy Release Notes](https://www.notion.so/Proxy-Release-Notes-1eb56175e18180259750f214196bf13b)
- [Supported Proxy Providers](https://www.notion.so/Proxy-fff56175e181812bb466f972b447dcd9)

## Development

### Running Without Proxy

To run without a proxy for testing:
1. Remove or comment out `PROXY_ACCOUNT_SLUG` from `.env`
2. The scraper will run without proxy (direct connection)

### Testing Locally

For local testing, set the `PROXY_ACCOUNT_SLUG` environment variable:

```bash
# In .env file
PROXY_ACCOUNT_SLUG=brightdata-datacenter

# Or as environment variable
export PROXY_ACCOUNT_SLUG=brightdata-datacenter
```

## Security Notes

- Never commit your `.env` file to version control
- Proxy credentials are loaded at runtime from environment variables
- All `.env` files are excluded from git via `.gitignore`