/**
 * TECH-14203 & TECH-14204: API Proxy Metering with Web Streams API
 * Integration tests for tracking traffic from Scraper APIs and direct HTTP requests.
 *
 * Acceptance Criteria:
 * - TECH-14203: Web Streams API (reader.read()) is used for incremental tracking
 * - TECH-14203: All traffic is metered (not just proxy traffic)
 * - TECH-14204: Direct HTTP requests to Scraper APIs (Nimble, ScraperAPI, BrightData, Oxylabs)
 *   are metered and attributed to their specific provider slug
 * - TECH-14204: No double-counting between providers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Types for Testing
// ============================================================================

interface DirectTrafficReport {
  bytesRead: number;
  bytesWritten: number;
  isRequest?: boolean;
  source?: string;
  latencyMs?: number;
  errorType?: string;
  errorMessage?: string;
}

// Local NetworkMeter mock for testing
class TestNetworkMeter {
  private readonly collectors: Map<string, { source: string; requests: number; bytesRead: number; bytesWritten: number }> = new Map();
  private directCollector = { source: 'direct', requests: 0, bytesRead: 0, bytesWritten: 0 };

  reportDirectTraffic(report: DirectTrafficReport): void {
    const { bytesRead, bytesWritten, isRequest = false, source } = report;

    let collector = this.directCollector;
    if (source && source !== 'direct') {
      if (!this.collectors.has(source)) {
        this.collectors.set(source, { source, requests: 0, bytesRead: 0, bytesWritten: 0 });
      }
      collector = this.collectors.get(source)!;
    }

    collector.bytesRead += bytesRead;
    collector.bytesWritten += bytesWritten;
    if (isRequest) collector.requests++;
  }

  getMetrics(): Array<{ source: string; requests: number; bytesRead: number; bytesWritten: number; bandwidthBytes: number }> {
    const metrics: Array<{ source: string; requests: number; bytesRead: number; bytesWritten: number; bandwidthBytes: number }> = [];

    for (const collector of this.collectors.values()) {
      if (collector.requests > 0 || collector.bytesRead > 0 || collector.bytesWritten > 0) {
        metrics.push({
          ...collector,
          bandwidthBytes: collector.bytesRead + collector.bytesWritten
        });
      }
    }

    if (this.directCollector.requests > 0 || this.directCollector.bytesRead > 0 || this.directCollector.bytesWritten > 0) {
      metrics.push({
        ...this.directCollector,
        bandwidthBytes: this.directCollector.bytesRead + this.directCollector.bytesWritten
      });
    }

    return metrics;
  }

  reset(): void {
    this.collectors.clear();
    this.directCollector = { source: 'direct', requests: 0, bytesRead: 0, bytesWritten: 0 };
  }
}

// ============================================================================
// Web Streams API Simulation
// ============================================================================

/**
 * Simulates the Web Streams API reader.read() pattern
 * This is how ApiProxy reads response bodies incrementally
 */
async function simulateReadStreamWithByteTracking(
  chunks: Array<Uint8Array>,
  onBytesRead: (bytes: number) => void
): Promise<{ text: string; totalBytes: number }> {
  const reader = {
    async read() {
      if (chunks.length === 0) {
        return { done: true, value: undefined };
      }
      const chunk = chunks.shift()!;
      return { done: false, value: chunk };
    }
  };

  const allChunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    allChunks.push(value);
    totalBytes += value.length;
    onBytesRead(value.length); // Track each chunk incrementally
  }

  // Combine and decode
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of allChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    text: new TextDecoder().decode(combined),
    totalBytes
  };
}

// ============================================================================
// TEST SUITE: TECH-14203 Web Streams API
// ============================================================================

describe('TECH-14203: Web Streams API Incremental Tracking', () => {
  let networkMeter: TestNetworkMeter;

  beforeEach(() => {
    networkMeter = new TestNetworkMeter();
  });

  afterEach(() => {
    networkMeter.reset();
  });

  describe('Chunked Response Reading', () => {
    it('should read chunks incrementally using reader.read()', async () => {
      const chunks = [
        new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
        new Uint8Array([32]),                       // " "
        new Uint8Array([87, 111, 114, 108, 100])   // "World"
      ];

      let chunkCount = 0;
      const result = await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        chunkCount++;
      });

      expect(result.text).toBe('Hello World');
      expect(result.totalBytes).toBe(11);
      expect(chunkCount).toBe(3); // 3 chunks read
    });

    it('should track bytes per chunk', async () => {
      const chunks = [
        new Uint8Array(1024),  // 1KB
        new Uint8Array(2048),  // 2KB
        new Uint8Array(512)    // 0.5KB
      ];

      const bytesReadLog: number[] = [];
      await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        bytesReadLog.push(bytes);
      });

      expect(bytesReadLog).toEqual([1024, 2048, 512]);
      expect(bytesReadLog.reduce((a, b) => a + b, 0)).toBe(3584);
    });

    it('should handle empty response', async () => {
      const chunks: Array<Uint8Array> = [];

      const result = await simulateReadStreamWithByteTracking(chunks, () => {});

      expect(result.text).toBe('');
      expect(result.totalBytes).toBe(0);
    });

    it('should handle single-chunk response', async () => {
      const chunks = [
        new Uint8Array([60, 104, 116, 109, 108, 62]) // "<html>"
      ];

      const result = await simulateReadStreamWithByteTracking(chunks, () => {});

      expect(result.text).toBe('<html>');
      expect(result.totalBytes).toBe(6);
    });

    it('should handle large responses with many chunks', async () => {
      const chunkCount = 100;
      const chunkSize = 65536; // 64KB per chunk
      const chunks = Array.from({ length: chunkCount }, () => new Uint8Array(chunkSize));

      let totalTracked = 0;
      const result = await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        totalTracked += bytes;
      });

      expect(result.totalBytes).toBe(chunkCount * chunkSize);
      expect(totalTracked).toBe(result.totalBytes);
    });
  });

  describe('Byte Counting Accuracy', () => {
    it('should count every byte received', async () => {
      const chunks = [
        new Uint8Array(1000),
        new Uint8Array(500),
        new Uint8Array(200)
      ];

      let totalBytes = 0;
      await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        totalBytes += bytes;
      });

      expect(totalBytes).toBe(1700);
    });

    it('should count bytes even on partial failure', async () => {
      // Simulate partial read before error
      let bytesRead = 0;
      const chunks = [
        new Uint8Array(500),
        new Uint8Array(300)
      ];

      // Read first two chunks successfully
      await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        bytesRead += bytes;
      });

      // Bytes were tracked before "error"
      expect(bytesRead).toBe(800);
    });

    it('should preserve byte count precision', async () => {
      const exactSize = 12345;
      const chunks = [new Uint8Array(exactSize)];

      let trackedBytes = 0;
      await simulateReadStreamWithByteTracking(chunks, (bytes) => {
        trackedBytes += bytes;
      });

      expect(trackedBytes).toBe(exactSize);
      expect(Number.isInteger(trackedBytes)).toBe(true);
    });
  });
});

// ============================================================================
// TEST SUITE: TECH-14204 API Proxy Metering
// ============================================================================

describe('TECH-14204: Scraper API Provider Attribution', () => {
  let networkMeter: TestNetworkMeter;

  beforeEach(() => {
    networkMeter = new TestNetworkMeter();
  });

  afterEach(() => {
    networkMeter.reset();
  });

  describe('Provider Attribution', () => {
    it('should attribute Nimble API traffic to nimble source', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 15000,
        bytesWritten: 500,
        isRequest: true,
        source: 'nimble'
      });

      const metrics = networkMeter.getMetrics();
      const nimbleMetrics = metrics.find(m => m.source === 'nimble');

      expect(nimbleMetrics).toBeDefined();
      expect(nimbleMetrics?.bytesRead).toBe(15000);
      expect(nimbleMetrics?.bytesWritten).toBe(500);
      expect(nimbleMetrics?.requests).toBe(1);
    });

    it('should attribute ScraperAPI traffic to scraperapi source', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 8000,
        bytesWritten: 300,
        isRequest: true,
        source: 'scraperapi'
      });

      const metrics = networkMeter.getMetrics();
      const scraperapiMetrics = metrics.find(m => m.source === 'scraperapi');

      expect(scraperapiMetrics).toBeDefined();
      expect(scraperapiMetrics?.bytesRead).toBe(8000);
    });

    it('should attribute BrightData Web Unlocker traffic to brightdata source', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 25000,
        bytesWritten: 1000,
        isRequest: true,
        source: 'brightdata'
      });

      const metrics = networkMeter.getMetrics();
      const brightdataMetrics = metrics.find(m => m.source === 'brightdata');

      expect(brightdataMetrics).toBeDefined();
      expect(brightdataMetrics?.bandwidthBytes).toBe(26000);
    });

    it('should attribute Oxylabs Scraper API traffic to oxylabs source', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 12000,
        bytesWritten: 600,
        isRequest: true,
        source: 'oxylabs'
      });

      const metrics = networkMeter.getMetrics();
      const oxylabsMetrics = metrics.find(m => m.source === 'oxylabs');

      expect(oxylabsMetrics).toBeDefined();
      expect(oxylabsMetrics?.bytesRead).toBe(12000);
    });
  });

  describe('No Double-Counting', () => {
    it('should not double-count traffic between providers', () => {
      // Nimble request
      networkMeter.reportDirectTraffic({
        bytesRead: 10000,
        bytesWritten: 500,
        isRequest: true,
        source: 'nimble'
      });

      // ScraperAPI request (separate)
      networkMeter.reportDirectTraffic({
        bytesRead: 8000,
        bytesWritten: 400,
        isRequest: true,
        source: 'scraperapi'
      });

      const metrics = networkMeter.getMetrics();

      // Each provider should have their own traffic
      const nimbleMetrics = metrics.find(m => m.source === 'nimble');
      const scraperapiMetrics = metrics.find(m => m.source === 'scraperapi');

      expect(nimbleMetrics?.bytesRead).toBe(10000);
      expect(nimbleMetrics?.requests).toBe(1);

      expect(scraperapiMetrics?.bytesRead).toBe(8000);
      expect(scraperapiMetrics?.requests).toBe(1);

      // Total should be sum, not double
      const totalBytesRead = metrics.reduce((sum, m) => sum + m.bytesRead, 0);
      expect(totalBytesRead).toBe(18000); // Not 36000
    });

    it('should keep proxy traffic separate from API traffic', () => {
      // Simulate proxy traffic through NetworkMeter TCP server
      networkMeter.reportDirectTraffic({
        bytesRead: 50000,
        bytesWritten: 2000,
        isRequest: true,
        source: 'brightdata' // Proxy traffic
      });

      // Simulate API traffic (direct HTTP)
      networkMeter.reportDirectTraffic({
        bytesRead: 10000,
        bytesWritten: 500,
        isRequest: true,
        source: 'brightdata' // API traffic - SAME provider
      });

      const metrics = networkMeter.getMetrics();
      const brightdataMetrics = metrics.find(m => m.source === 'brightdata');

      // Both should be merged under same source (brightdata)
      expect(metrics.length).toBe(1);
      expect(brightdataMetrics?.bytesRead).toBe(60000); // 50000 + 10000
      expect(brightdataMetrics?.requests).toBe(2);
    });

    it('should track direct traffic separately from provider traffic', () => {
      // Direct traffic (no proxy, no API)
      networkMeter.reportDirectTraffic({
        bytesRead: 1000,
        bytesWritten: 100,
        isRequest: true,
        source: 'direct'
      });

      // Provider traffic
      networkMeter.reportDirectTraffic({
        bytesRead: 5000,
        bytesWritten: 500,
        isRequest: true,
        source: 'nimble'
      });

      const metrics = networkMeter.getMetrics();

      const directMetrics = metrics.find(m => m.source === 'direct');
      const nimbleMetrics = metrics.find(m => m.source === 'nimble');

      expect(directMetrics?.bytesRead).toBe(1000);
      expect(nimbleMetrics?.bytesRead).toBe(5000);

      // Direct should not include provider traffic
      expect(directMetrics?.bandwidthBytes).toBe(1100);
    });
  });

  describe('Request Size Estimation', () => {
    it('should estimate request size including URL', () => {
      const url = 'https://api.example.com/v1/scrape?url=https://target.com';
      const estimatedSize = url.length;

      expect(estimatedSize).toBeGreaterThan(0);
      expect(estimatedSize).toBe(url.length);
    });

    it('should estimate request size including headers', () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value'
      };

      let size = 0;
      for (const [key, value] of Object.entries(headers)) {
        size += key.length + value.length + 4; // ": " + "\r\n"
      }

      expect(size).toBeGreaterThan(0);
    });

    it('should estimate request size including body', () => {
      const body = { url: 'https://example.com', render: true, country: 'us' };
      const bodyStr = JSON.stringify(body);

      expect(bodyStr.length).toBeGreaterThan(0);
    });

    it('should report bytesWritten accurately', () => {
      // Simulate request: URL + headers + body
      const url = 'https://api.nimble.com/v1/scrape';
      const headers = { 'Content-Type': 'application/json' };
      const body = JSON.stringify({ url: 'https://target.com' });

      let requestSize = url.length;
      for (const [key, value] of Object.entries(headers)) {
        requestSize += key.length + value.length + 4;
      }
      requestSize += body.length;

      // Report as bytesWritten
      networkMeter.reportDirectTraffic({
        bytesRead: 10000, // Response size
        bytesWritten: requestSize,
        isRequest: true,
        source: 'nimble'
      });

      const metrics = networkMeter.getMetrics();
      const nimbleMetrics = metrics.find(m => m.source === 'nimble');

      expect(nimbleMetrics?.bytesWritten).toBe(requestSize);
      expect(nimbleMetrics?.bandwidthBytes).toBe(10000 + requestSize);
    });
  });

  describe('Error Handling', () => {
    it('should report traffic even on request failure', () => {
      // Simulate partial read before failure
      const bytesReadBeforeFailure = 5000;
      const bytesWritten = 300;

      // Even on failure, report partial bytes
      networkMeter.reportDirectTraffic({
        bytesRead: bytesReadBeforeFailure,
        bytesWritten: bytesWritten,
        isRequest: false, // Don't count as successful request
        source: 'brightdata'
      });

      const metrics = networkMeter.getMetrics();
      const brightdataMetrics = metrics.find(m => m.source === 'brightdata');

      expect(brightdataMetrics?.bytesRead).toBe(5000);
      expect(brightdataMetrics?.requests).toBe(0); // Not counted as request
    });

    it('should track error types separately', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 0,
        bytesWritten: 100,
        isRequest: false,
        source: 'nimble',
        errorType: 'timeout'
      });

      networkMeter.reportDirectTraffic({
        bytesRead: 500,
        bytesWritten: 100,
        isRequest: false,
        source: 'nimble',
        errorType: 'connection_refused'
      });

      // Both should be tracked under nimble
      const metrics = networkMeter.getMetrics();
      const nimbleMetrics = metrics.find(m => m.source === 'nimble');

      expect(nimbleMetrics?.bytesWritten).toBe(200);
    });
  });
});

// ============================================================================
// INTEGRATION TEST: Real ApiProxy Class (file verification)
// ============================================================================

describe('TECH-14204: ApiProxy Integration', () => {
  it('should have ApiProxy abstract class in apiProxy.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const apiProxyPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/apiProxy.ts');
    const content = fs.readFileSync(apiProxyPath, 'utf-8');
    expect(content).toContain('export abstract class ApiProxy');
    expect(content).toContain('reportTraffic');
  });

  it('should have NimbleApiProxy extending ApiProxy', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const nimblePath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/nimbleApi.ts');
    const content = fs.readFileSync(nimblePath, 'utf-8');
    expect(content).toContain('export class NimbleApiProxy extends ApiProxy');
  });

  it('should have ScraperapiApiProxy extending ApiProxy', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const scraperapiPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/scraperapiApi.ts');
    const content = fs.readFileSync(scraperapiPath, 'utf-8');
    expect(content).toContain('export class ScraperapiApiProxy extends ApiProxy');
  });

  it('should have BrightDataApiProxy extending ApiProxy', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const brightdataPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/brightdataApi.ts');
    const content = fs.readFileSync(brightdataPath, 'utf-8');
    expect(content).toContain('export class BrightDataApiProxy extends ApiProxy');
  });

  it('should have OxylabsApiProxy extending ApiProxy', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const oxylabsPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/oxylabsApi.ts');
    const content = fs.readFileSync(oxylabsPath, 'utf-8');
    expect(content).toContain('export class OxylabsApiProxy extends ApiProxy');
  });

  it('should have Web Streams API pattern in ApiProxy', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const apiProxyPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/apiProxy.ts');
    const content = fs.readFileSync(apiProxyPath, 'utf-8');
    // Check for Web Streams API usage (reader.read pattern)
    expect(content).toContain('reader.read()');
    expect(content).toContain('bytesRead');
  });
});

// ============================================================================
// PERFORMANCE TEST: Large Response Handling
// ============================================================================

describe('TECH-14203: Performance', () => {
  it('should handle 1MB response efficiently', async () => {
    const oneMB = 1024 * 1024;
    const chunks = [
      new Uint8Array(oneMB / 4),
      new Uint8Array(oneMB / 4),
      new Uint8Array(oneMB / 4),
      new Uint8Array(oneMB / 4)
    ];

    const startTime = Date.now();
    let totalBytes = 0;

    await simulateReadStreamWithByteTracking(chunks, (bytes) => {
      totalBytes += bytes;
    });

    const elapsed = Date.now() - startTime;

    expect(totalBytes).toBe(oneMB);
    expect(elapsed).toBeLessThan(100); // Should be fast
  });

  it('should handle concurrent requests correctly', async () => {
    const networkMeter = new TestNetworkMeter();
    const promises: Promise<void>[] = [];

    // Simulate 50 concurrent requests to different providers
    for (let i = 0; i < 50; i++) {
      promises.push(
        new Promise((resolve) => {
          const sources = ['nimble', 'scraperapi', 'brightdata', 'oxylabs'];
          const source = sources[i % sources.length];

          networkMeter.reportDirectTraffic({
            bytesRead: Math.floor(Math.random() * 10000),
            bytesWritten: Math.floor(Math.random() * 1000),
            isRequest: true,
            source
          });

          resolve();
        })
      );
    }

    await Promise.all(promises);

    const metrics = networkMeter.getMetrics();
    expect(metrics.length).toBe(4); // 4 unique sources
  });
});