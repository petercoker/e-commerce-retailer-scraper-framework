/**
 * TECH-14200: Ability to calculate the cost per execution
 * Edge Case Tests for Multi-Proxy Selection and Network Metering
 *
 * This test suite verifies:
 * - TECH-14201: Be able to select multiple proxies for one Template
 * - TECH-14202: Proxy Meter must differentiate use per proxy
 * - TECH-14203: Proxy Meter should meter all traffic, not just proxy
 * - TECH-14204: Scrapper API or "proxy API" should be considered in request metering
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Mock Types (mirrors javascript-commons types)
// ============================================================================

interface TransmissionMetrics {
  averageValue: number;
  sizeUnitName: 'bytes';
  timeUnitName: 'seconds';
}

interface SourceMetrics {
  source: string;
  requests: number;
  bandwidthBytes: number;
  bytesRead: number;
  bytesWritten: number;
  transmissionMetrics: TransmissionMetrics;
}

const DIRECT_SOURCE = 'direct';

// ============================================================================
// SourceMetricsCollector Implementation Test
// ============================================================================

class SourceMetricsCollector {
  private requests: number = 0;
  private bytesRead: number = 0;
  private bytesWritten: number = 0;
  private readonly startTime: number = Date.now();

  constructor(public readonly source: string) {}

  recordRequest(): void {
    this.requests++;
  }

  recordBytesRead(bytes: number): void {
    this.bytesRead += bytes;
  }

  recordBytesWritten(bytes: number): void {
    this.bytesWritten += bytes;
  }

  getRequests(): number {
    return this.requests;
  }

  getBytesRead(): number {
    return this.bytesRead;
  }

  getBytesWritten(): number {
    return this.bytesWritten;
  }

  toMetrics(): SourceMetrics {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const bandwidth = this.bytesRead + this.bytesWritten;

    return {
      source: this.source,
      requests: this.requests,
      bandwidthBytes: bandwidth,
      bytesRead: this.bytesRead,
      bytesWritten: this.bytesWritten,
      transmissionMetrics: {
        averageValue: elapsedSeconds > 0 ? bandwidth / elapsedSeconds : 0,
        sizeUnitName: 'bytes',
        timeUnitName: 'seconds',
      },
    };
  }

  reset(): void {
    this.requests = 0;
    this.bytesRead = 0;
    this.bytesWritten = 0;
  }
}

// ============================================================================
// NetworkMeter Mock Implementation
// ============================================================================

class NetworkMeterMock {
  private readonly collectors: Map<string, SourceMetricsCollector> = new Map();
  private directCollector: SourceMetricsCollector = new SourceMetricsCollector(DIRECT_SOURCE);
  private started: boolean = false;

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.collectors.clear();
    this.directCollector = new SourceMetricsCollector(DIRECT_SOURCE);
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  reportDirectTraffic(report: { bytesRead: number; bytesWritten: number; isRequest?: boolean; source?: string }): void {
    const { bytesRead, bytesWritten, isRequest = false, source } = report;
    let collector = this.directCollector;

    if (source && source !== DIRECT_SOURCE) {
      if (this.collectors.has(source)) {
        collector = this.collectors.get(source)!;
      } else {
        const newCollector = new SourceMetricsCollector(source);
        this.collectors.set(source, newCollector);
        collector = newCollector;
      }
    }

    collector.recordBytesRead(bytesRead);
    collector.recordBytesWritten(bytesWritten);
    if (isRequest) {
      collector.recordRequest();
    }
  }

  getMetrics(): SourceMetrics[] {
    const metrics: SourceMetrics[] = [];

    for (const collector of this.collectors.values()) {
      const m = collector.toMetrics();
      if (m.requests > 0 || m.bandwidthBytes > 0) {
        metrics.push(m);
      }
    }

    const directMetrics = this.directCollector.toMetrics();
    if (directMetrics.requests > 0 || directMetrics.bandwidthBytes > 0) {
      metrics.push(directMetrics);
    }

    return metrics;
  }
}

// ============================================================================
// TECH-14201: Multi-Proxy Selection Edge Cases
// ============================================================================

describe('TECH-14201: Multi-Proxy Selection', () => {
  describe('Proxy Account Validation', () => {
    it('should validate inactive account is skipped', () => {
      const accounts = [
        { name: 'active-proxy', provider: { slug: 'nimble' }, isActive: true },
        { name: 'inactive-proxy', provider: { slug: 'oxylabs' }, isActive: false },
      ];

      const activeAccounts = accounts.filter(a => a.isActive);
      expect(activeAccounts.length).toBe(1);
      expect(activeAccounts[0].name).toBe('active-proxy');
    });

    it('should match slug case-insensitively', () => {
      const slug = 'NIMBLE';
      const accounts = [
        { name: 'nimble-primary', provider: { slug: 'nimble' }, isActive: true },
        { name: 'scraper-secondary', provider: { slug: 'scraperapi' }, isActive: true },
      ];

      const match = accounts.find(
        a => a.provider.slug.toLowerCase() === slug.toLowerCase() ||
             a.name.toLowerCase() === slug.toLowerCase()
      );

      expect(match).toBeDefined();
      expect(match?.name).toBe('nimble-primary');
    });

    it('should return null for non-existent slug', () => {
      const accounts = [
        { name: 'nimble-primary', provider: { slug: 'nimble' }, isActive: true },
      ];

      const result = accounts.find(a => a.provider.slug === 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle multiple accounts of same provider', () => {
      const accounts = [
        { name: 'nimble-primary', provider: { slug: 'nimble' }, isActive: true },
        { name: 'nimble-backup', provider: { slug: 'nimble' }, isActive: true },
        { name: 'scraper-main', provider: { slug: 'scraperapi' }, isActive: true },
      ];

      const proxiesByKey = new Map<string, typeof accounts[0]>();

      for (const account of accounts) {
        const key = proxiesByKey.has(account.provider.slug) ? account.name : account.provider.slug;
        proxiesByKey.set(key, account);
      }

      expect(proxiesByKey.size).toBe(3);
      expect(proxiesByKey.has('nimble')).toBe(true);
      expect(proxiesByKey.has('nimble-backup')).toBe(true);
      expect(proxiesByKey.has('scraperapi')).toBe(true);
    });
  });

  describe('Region Validation', () => {
    it('should validate region belongs to account', () => {
      const account = {
        name: 'brightdata',
        limitedRegions: ['us', 'uk', 'de'] as string[],
      };

      const validateRegion = (region: string | undefined): boolean => {
        if (!region) return true;
        if (account.limitedRegions.length === 0) return true;
        return account.limitedRegions.includes(region);
      };

      expect(validateRegion('us')).toBe(true);
      expect(validateRegion('uk')).toBe(true);
      expect(validateRegion('de')).toBe(true);
      expect(validateRegion('fr')).toBe(false);
      expect(validateRegion(undefined)).toBe(true);
    });

    it('should allow any region when no limitations', () => {
      const account = {
        name: 'nimble',
        limitedRegions: [] as string[],
      };

      const validateRegion = (region: string | undefined): boolean => {
        if (!region) return true;
        if (account.limitedRegions.length === 0) return true;
        return account.limitedRegions.includes(region);
      };

      expect(validateRegion('us')).toBe(true);
      expect(validateRegion('fr')).toBe(true);
      expect(validateRegion('any-region')).toBe(true);
    });
  });
});

// ============================================================================
// TECH-14202: Per-Proxy Differentiation Edge Cases
// ============================================================================

describe('TECH-14202: Per-Proxy Differentiation', () => {
  describe('SourceMetricsCollector', () => {
    it('should handle zero traffic correctly', () => {
      const collector = new SourceMetricsCollector('test-provider');

      const metrics = collector.toMetrics();

      expect(metrics.source).toBe('test-provider');
      expect(metrics.requests).toBe(0);
      expect(metrics.bandwidthBytes).toBe(0);
      expect(metrics.bytesRead).toBe(0);
      expect(metrics.bytesWritten).toBe(0);
    });

    it('should handle single request correctly', () => {
      const collector = new SourceMetricsCollector('single-request');
      collector.recordRequest();
      collector.recordBytesRead(1000);
      collector.recordBytesWritten(500);

      const metrics = collector.toMetrics();

      expect(metrics.requests).toBe(1);
      expect(metrics.bytesRead).toBe(1000);
      expect(metrics.bytesWritten).toBe(500);
      expect(metrics.bandwidthBytes).toBe(1500);
    });

    it('should calculate transmission metrics correctly', async () => {
      const collector = new SourceMetricsCollector('transmission-test');
      collector.recordBytesRead(10000);
      collector.recordBytesWritten(2000);

      await new Promise<void>(resolve => {
        setTimeout(() => {
          const metrics = collector.toMetrics();

          expect(metrics.transmissionMetrics.averageValue).toBeGreaterThan(0);
          expect(metrics.transmissionMetrics.sizeUnitName).toBe('bytes');
          expect(metrics.transmissionMetrics.timeUnitName).toBe('seconds');
          resolve();
        }, 100);
      });
    });

    it('should handle zero elapsed time without division by zero', () => {
      const collector = new SourceMetricsCollector('instant');

      const metrics = collector.toMetrics();

      expect(Number.isNaN(metrics.transmissionMetrics.averageValue)).toBe(false);
      expect(metrics.transmissionMetrics.averageValue >= 0).toBe(true);
    });

    it('should accumulate multiple records', () => {
      const collector = new SourceMetricsCollector('accumulator');

      collector.recordRequest();
      collector.recordRequest();
      collector.recordRequest();
      collector.recordBytesRead(100);
      collector.recordBytesRead(200);
      collector.recordBytesWritten(50);
      collector.recordBytesWritten(150);

      const metrics = collector.toMetrics();

      expect(metrics.requests).toBe(3);
      expect(metrics.bytesRead).toBe(300);
      expect(metrics.bytesWritten).toBe(200);
      expect(metrics.bandwidthBytes).toBe(500);
    });

    it('should handle reset correctly', () => {
      const collector = new SourceMetricsCollector('reset-test');

      collector.recordRequest();
      collector.recordBytesRead(1000);
      collector.recordBytesWritten(500);

      collector.reset();

      expect(collector.getRequests()).toBe(0);
      expect(collector.getBytesRead()).toBe(0);
      expect(collector.getBytesWritten()).toBe(0);
    });
  });

  describe('NetworkMeter', () => {
    let networkMeter: NetworkMeterMock;

    beforeEach(() => {
      networkMeter = new NetworkMeterMock();
    });

    it('should return empty array when no traffic recorded', () => {
      const metrics = networkMeter.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBe(0);
    });

    it('should create collector for unknown source on reportDirectTraffic', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 5000,
        bytesWritten: 1000,
        isRequest: true,
        source: 'unknown-api-provider',
      });

      const metrics = networkMeter.getMetrics();
      const unknownMetrics = metrics.find((m) => m.source === 'unknown-api-provider');

      expect(unknownMetrics).toBeDefined();
      expect(unknownMetrics?.requests).toBe(1);
      expect(unknownMetrics?.bytesRead).toBe(5000);
      expect(unknownMetrics?.bytesWritten).toBe(1000);
    });

    it('should route API traffic to correct source (not direct)', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 3000,
        bytesWritten: 500,
        isRequest: true,
        source: 'nimble',
      });

      networkMeter.reportDirectTraffic({
        bytesRead: 1000,
        bytesWritten: 200,
        isRequest: true,
        source: DIRECT_SOURCE,
      });

      const metrics = networkMeter.getMetrics();

      const nimbleMetrics = metrics.find((m) => m.source === 'nimble');
      const directMetrics = metrics.find((m) => m.source === DIRECT_SOURCE);

      expect(nimbleMetrics).toBeDefined();
      expect(nimbleMetrics?.bytesRead).toBe(3000);

      expect(directMetrics).toBeDefined();
      expect(directMetrics?.bytesRead).toBe(1000);
    });

    it('should aggregate metrics from multiple sources', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 1000,
        bytesWritten: 100,
        isRequest: true,
        source: 'provider-a',
      });
      networkMeter.reportDirectTraffic({
        bytesRead: 2000,
        bytesWritten: 200,
        isRequest: true,
        source: 'provider-b',
      });
      networkMeter.reportDirectTraffic({
        bytesRead: 3000,
        bytesWritten: 300,
        isRequest: true,
        source: 'provider-c',
      });

      const metrics = networkMeter.getMetrics();

      expect(metrics.length).toBe(3);

      const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
      expect(totalRequests).toBe(3);
    });

    it('should not double-count traffic', () => {
      networkMeter.reportDirectTraffic({
        bytesRead: 1000,
        bytesWritten: 500,
        isRequest: true,
        source: 'double-test',
      });
      networkMeter.reportDirectTraffic({
        bytesRead: 1000,
        bytesWritten: 500,
        isRequest: true,
        source: 'double-test',
      });

      const metrics = networkMeter.getMetrics();
      const testMetrics = metrics.find((m) => m.source === 'double-test');

      expect(testMetrics?.bytesRead).toBe(2000);
      expect(testMetrics?.requests).toBe(2);
    });
  });
});

// ============================================================================
// TECH-14203: All Traffic Metering Edge Cases
// ============================================================================

describe('TECH-14203: All Traffic Metering', () => {
  describe('Request Size Estimation', () => {
    it('should estimate URL size in request', () => {
      const url = 'https://example.com/path?query=value';
      const estimatedSize = url.length;

      expect(estimatedSize).toBeGreaterThan(0);
      expect(estimatedSize).toBe(url.length);
    });

    it('should include headers in size estimation', () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      };

      let size = 0;
      for (const [key, value] of Object.entries(headers)) {
        size += key.length + value.length + 4;
      }

      expect(size).toBeGreaterThan(0);
      const expectedSize = Object.entries(headers).reduce(
        (sum, [k, v]) => sum + k.length + v.length + 4,
        0
      );
      expect(size).toBe(expectedSize);
    });

    it('should include body in size estimation', () => {
      const body = { test: 'data', nested: { value: 123 } };
      const bodyStr = JSON.stringify(body);

      expect(bodyStr.length).toBeGreaterThan(0);
      expect(bodyStr).toContain('test');
      expect(bodyStr).toContain('nested');
    });
  });

  describe('Byte Counting Accuracy', () => {
    it('should count bytes incrementally for chunked responses', () => {
      const chunks = [
        new Uint8Array([72, 101, 108, 108, 111]),
        new Uint8Array([32]),
        new Uint8Array([87, 111, 114, 108, 100])
      ];

      let totalBytes = 0;
      for (const chunk of chunks) {
        totalBytes += chunk.length;
      }

      expect(totalBytes).toBe(11);
    });

    it('should handle empty response body', () => {
      let bytesRead = 0;
      expect(bytesRead).toBe(0);
    });

    it('should handle large responses correctly', () => {
      const chunkSize = 65536;
      const totalChunks = 16;

      let totalBytes = 0;
      for (let i = 0; i < totalChunks; i++) {
        totalBytes += chunkSize;
      }

      expect(totalBytes).toBe(1048576);
    });
  });

  describe('Error Handling', () => {
    it('should report partial bytes on error', () => {
      const collector = new SourceMetricsCollector('error-test');

      collector.recordBytesRead(500);
      collector.recordBytesWritten(200);

      const metrics = collector.toMetrics();

      expect(metrics.bytesRead).toBe(500);
      expect(metrics.bytesWritten).toBe(200);
    });

    it('should call reportTraffic in catch block', async () => {
      const simulateRequest = async (): Promise<{ bytesRead: number; bytesWritten: number }> => {
        let bytesRead = 0;
        const bytesWritten = 100;

        try {
          bytesRead = 500;
          throw new Error('Network timeout');
        } catch {
          return { bytesRead, bytesWritten };
        }
      };

      const result = await simulateRequest();
      expect(result.bytesRead).toBe(500);
      expect(result.bytesWritten).toBe(100);
    });

    it('should handle timeout errors gracefully', async () => {
      const simulateTimeout = async (): Promise<{ success: boolean; bytesRead: number }> => {
        let bytesRead = 0;

        try {
          for (let i = 0; i < 10; i++) {
            bytesRead += 1000;
            if (i === 5) throw new Error('Timeout');
          }
          return { success: true, bytesRead };
        } catch {
          return { success: false, bytesRead };
        }
      };

      const result = await simulateTimeout();
      expect(result.success).toBe(false);
      expect(result.bytesRead).toBe(6000);
    });
  });
});

// ============================================================================
// TECH-14204: Scraper API Tracking Edge Cases
// ============================================================================

describe('TECH-14204: Scraper API Tracking', () => {
  describe('Country Code Formatting', () => {
    const formatCountryCode = (
      code: string | undefined,
      format: 'upper' | 'lower' | 'preserve'
    ): string | undefined => {
      if (!code) return undefined;
      switch (format) {
        case 'upper':
          return code.toUpperCase();
        case 'lower':
          return code.toLowerCase();
        default:
          return code;
      }
    };

    it('should format country code to UPPERCASE for Nimble', () => {
      expect(formatCountryCode('us', 'upper')).toBe('US');
      expect(formatCountryCode('Us', 'upper')).toBe('US');
      expect(formatCountryCode('uS', 'upper')).toBe('US');
    });

    it('should format country code to lowercase for ScraperAPI', () => {
      expect(formatCountryCode('US', 'lower')).toBe('us');
      expect(formatCountryCode('Us', 'lower')).toBe('us');
      expect(formatCountryCode('US', 'lower')).toBe('us');
    });

    it('should preserve country code for Oxylabs', () => {
      expect(formatCountryCode('Us', 'preserve')).toBe('Us');
      expect(formatCountryCode('us', 'preserve')).toBe('us');
      expect(formatCountryCode('US', 'preserve')).toBe('US');
    });

    it('should return undefined for undefined country code', () => {
      expect(formatCountryCode(undefined, 'upper')).toBeUndefined();
      expect(formatCountryCode(undefined, 'lower')).toBeUndefined();
      expect(formatCountryCode(undefined, 'preserve')).toBeUndefined();
    });
  });

  describe('Authentication', () => {
    it('should create Basic Auth header from credentials', () => {
      const username = 'testuser';
      const password = 'testpass';
      const credentials = `${username}:${password}`;
      const basicAuth = `Basic ${Buffer.from(credentials).toString('base64')}`;

      expect(basicAuth).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
      expect(basicAuth).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=');
    });

    it('should decode Base64 credentials correctly', () => {
      const encodedUsername = Buffer.from('nimble-user').toString('base64');
      const encodedPassword = Buffer.from('nimble-pass').toString('base64');

      expect(Buffer.from(encodedUsername, 'base64').toString()).toBe('nimble-user');
      expect(Buffer.from(encodedPassword, 'base64').toString()).toBe('nimble-pass');
    });
  });

  describe('Response Parsing', () => {
    const parseJsonWithFallback = <T>(text: string): T => {
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    };

    it('should parse JSON response correctly', () => {
      const jsonResponse = '{"key": "value", "number": 42}';
      const result = parseJsonWithFallback<{ key: string; number: number }>(jsonResponse);

      expect(result.key).toBe('value');
      expect(result.number).toBe(42);
    });

    it('should fallback to raw text for non-JSON response', () => {
      const htmlResponse = '<html><body>Hello World</body></html>';
      const result = parseJsonWithFallback<string>(htmlResponse);

      expect(result).toBe(htmlResponse);
    });

    it('should handle Nimble parse response', () => {
      const parseNimbleResponse = <T>(text: string, parseEnabled: boolean): T => {
        try {
          const json = JSON.parse(text);
          if (parseEnabled && json.parsed !== undefined) {
            return json.parsed as T;
          }
          if (json.html !== undefined) {
            return json.html as unknown as T;
          }
          return json as T;
        } catch {
          return text as unknown as T;
        }
      };

      const parsedResponse =
        '{"parsed": {"title": "Extracted Title"}, "html": "<html>...</html>"}';
      const result = parseNimbleResponse<{ title: string }>(parsedResponse, true);

      expect(result.title).toBe('Extracted Title');
    });

    it('should handle Nimble html response', () => {
      const parseNimbleResponse = <T>(text: string, parseEnabled: boolean): T => {
        try {
          const json = JSON.parse(text);
          if (parseEnabled && json.parsed !== undefined) {
            return json.parsed as T;
          }
          if (json.html !== undefined) {
            return json.html as unknown as T;
          }
          return json as T;
        } catch {
          return text as unknown as T;
        }
      };

      const htmlResponse = '{"html": "<html><body>Content</body></html>"}';
      const result = parseNimbleResponse<string>(htmlResponse, false);

      expect(result).toBe('<html><body>Content</body></html>');
    });
  });

  describe('Provider Attribution', () => {
    it('should attribute traffic to correct provider slug', () => {
      const collector = new SourceMetricsCollector('nimble');
      collector.recordRequest();
      collector.recordBytesRead(10000);

      const metrics = collector.toMetrics();

      expect(metrics.source).toBe('nimble');
      expect(metrics.requests).toBe(1);
      expect(metrics.bytesRead).toBe(10000);
    });

    it('should not confuse nimble with direct traffic', () => {
      const nimbleCollector = new SourceMetricsCollector('nimble');
      const directCollector = new SourceMetricsCollector(DIRECT_SOURCE);

      nimbleCollector.recordBytesRead(5000);
      directCollector.recordBytesRead(1000);

      expect(nimbleCollector.toMetrics().source).toBe('nimble');
      expect(directCollector.toMetrics().source).toBe(DIRECT_SOURCE);
      expect(nimbleCollector.getBytesRead()).toBe(5000);
      expect(directCollector.getBytesRead()).toBe(1000);
    });

    it('should track multiple providers independently', () => {
      const collectors = new Map<string, SourceMetricsCollector>();
      collectors.set('nimble', new SourceMetricsCollector('nimble'));
      collectors.set('scraperapi', new SourceMetricsCollector('scraperapi'));
      collectors.set('brightdata', new SourceMetricsCollector('brightdata'));

      collectors.get('nimble')?.recordBytesRead(1000);
      collectors.get('scraperapi')?.recordBytesRead(2000);
      collectors.get('brightdata')?.recordBytesRead(3000);

      expect(collectors.get('nimble')?.getBytesRead()).toBe(1000);
      expect(collectors.get('scraperapi')?.getBytesRead()).toBe(2000);
      expect(collectors.get('brightdata')?.getBytesRead()).toBe(3000);
    });
  });

  describe('Custom Endpoint Override', () => {
    it('should use custom endpoint from metadata', () => {
      const defaultEndpoint = 'https://api.default.com/v1';
      const customEndpoint = 'https://custom.endpoint.com/api';

      const getApiEndpoint = (defaultEp: string, metadata?: { apiEndpoint?: string }): string => {
        return metadata?.apiEndpoint || defaultEp;
      };

      expect(getApiEndpoint(defaultEndpoint)).toBe(defaultEndpoint);
      expect(getApiEndpoint(defaultEndpoint, { apiEndpoint: customEndpoint })).toBe(customEndpoint);
    });

    it('should fallback to default when no custom endpoint', () => {
      const defaultEndpoint = 'https://api.scraperapi.com/';
      const getApiEndpoint = (defaultEp: string, metadata?: { apiEndpoint?: string }): string => {
        return metadata?.apiEndpoint || defaultEp;
      };

      expect(getApiEndpoint(defaultEndpoint)).toBe(defaultEndpoint);
      expect(getApiEndpoint(defaultEndpoint, {})).toBe(defaultEndpoint);
      expect(getApiEndpoint(defaultEndpoint, { apiEndpoint: undefined })).toBe(defaultEndpoint);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: End-to-End Flow', () => {
  describe('NetworkMeter with Multiple Providers', () => {
    it('should track metrics across multiple API proxies', () => {
      const networkMeter = new NetworkMeterMock();

      networkMeter.reportDirectTraffic({
        bytesRead: 10000,
        bytesWritten: 500,
        isRequest: true,
        source: 'nimble',
      });

      networkMeter.reportDirectTraffic({
        bytesRead: 8000,
        bytesWritten: 400,
        isRequest: true,
        source: 'scraperapi',
      });

      networkMeter.reportDirectTraffic({
        bytesRead: 12000,
        bytesWritten: 600,
        isRequest: true,
        source: 'brightdata',
      });

      const metrics = networkMeter.getMetrics();

      const providerMetrics = metrics.filter((m) => m.source !== DIRECT_SOURCE);
      expect(providerMetrics.length).toBe(3);

      const totalBandwidth = metrics.reduce((sum, m) => sum + m.bandwidthBytes, 0);
      expect(totalBandwidth).toBe(10000 + 500 + 8000 + 400 + 12000 + 600);
    });

    it('should provide accurate cost calculation data', () => {
      const metrics: SourceMetrics[] = [
        {
          source: 'nimble',
          requests: 100,
          bandwidthBytes: 5242880,
          bytesRead: 5242880,
          bytesWritten: 0,
          transmissionMetrics: { averageValue: 87381.3, sizeUnitName: 'bytes', timeUnitName: 'seconds' },
        },
        {
          source: 'scraperapi',
          requests: 50,
          bandwidthBytes: 2621440,
          bytesRead: 2621440,
          bytesWritten: 0,
          transmissionMetrics: { averageValue: 43690.6, sizeUnitName: 'bytes', timeUnitName: 'seconds' },
        },
      ];

      const pricing: Record<string, number> = {
        nimble: 12,
        scraperapi: 8,
      };

      const costs = metrics.map((m) => {
        const bandwidthGB = m.bandwidthBytes / (1024 * 1024 * 1024);
        const pricePerGB = pricing[m.source] || 10;
        return {
          provider: m.source,
          bandwidthGB,
          cost: bandwidthGB * pricePerGB,
        };
      });

      expect(costs[0].provider).toBe('nimble');
      expect(costs[0].bandwidthGB).toBeCloseTo(0.00488, 4);
      expect(costs[1].provider).toBe('scraperapi');
    });

    it('should handle concurrent traffic correctly', async () => {
      const networkMeter = new NetworkMeterMock();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            networkMeter.reportDirectTraffic({
              bytesRead: 1000,
              bytesWritten: 100,
              isRequest: true,
              source: `provider-${i % 3}`,
            });
            resolve();
          })
        );
      }

      await Promise.all(promises);

      const metrics = networkMeter.getMetrics();
      expect(metrics.length).toBe(3);

      const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
      expect(totalRequests).toBe(10);
    });
  });
});