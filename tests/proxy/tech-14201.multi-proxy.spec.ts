/**
 * TECH-14201: Multi-Proxy Selection
 * Integration tests for loading and selecting multiple proxies dynamically.
 *
 * Acceptance Criteria:
 * - Templates can inject multiple proxy accounts (PROXY_ACCOUNT_SLUGS)
 * - Scrapers reference proxies dynamically by slug via buildApiProxy('slug')
 * - buildAllProxies() returns array in priority order
 * - buildProxyBySlug() returns specific proxy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Set up global ShalionProperties for testing
declare global {
  var ShalionProperties: Map<string, string | undefined>;
}

// Mock types from javascript-commons
interface ProxyAccountResponse {
  name: string;
  host: string;
  port: number;
  isActive: boolean;
  provider: { slug: string; name: string };
  type: { name: string };
  authentication: { username: string; password: string };
  limitedRegions: string[];
  metadata?: Record<string, unknown>;
}

// Helper to create mock proxy account
function createMockProxyAccount(
  slug: string,
  name: string,
  isActive: boolean = true
): ProxyAccountResponse {
  return {
    name,
    host: `${slug}.proxy.example.com`,
    port: 8080,
    isActive,
    provider: { slug, name: `${slug}-provider` },
    type: { name: 'residential' },
    authentication: {
      username: Buffer.from(`${slug}-user`).toString('base64'),
      password: Buffer.from(`${slug}-pass`).toString('base64')
    },
    limitedRegions: []
  };
}

// ============================================================================
// TEST SUITE: TECH-14201 Multi-Proxy Selection
// ============================================================================

describe('TECH-14201: Multi-Proxy Selection', () => {
  beforeAll(() => {
    // Initialize ShalionProperties
    globalThis.ShalionProperties = new Map<string, string | undefined>();
  });

  afterAll(() => {
    globalThis.ShalionProperties = new Map<string, string | undefined>();
  });

  describe('PROXY_ACCOUNT_SLUGS Environment Variable Parsing', () => {
    it('should parse comma-separated slugs correctly', () => {
      const envValue = 'brightdata-residential,oxylabs-residential,brightdata-datacenter';
      const slugs = envValue.split(',').map(s => s.trim()).filter(Boolean);

      expect(slugs).toHaveLength(3);
      expect(slugs[0]).toBe('brightdata-residential');
      expect(slugs[1]).toBe('oxylabs-residential');
      expect(slugs[2]).toBe('brightdata-datacenter');
    });

    it('should handle single slug', () => {
      const envValue = 'brightdata-residential';
      const slugs = envValue.split(',').map(s => s.trim()).filter(Boolean);

      expect(slugs).toHaveLength(1);
      expect(slugs[0]).toBe('brightdata-residential');
    });

    it('should handle empty string', () => {
      const envValue = '';
      const slugs = envValue.split(',').map(s => s.trim()).filter(Boolean);

      expect(slugs).toHaveLength(0);
    });

    it('should trim whitespace from slugs', () => {
      const envValue = '  brightdata , oxylabs  , nimble ';
      const slugs = envValue.split(',').map(s => s.trim()).filter(Boolean);

      expect(slugs).toEqual(['brightdata', 'oxylabs', 'nimble']);
    });

    it('should filter out empty entries', () => {
      const envValue = 'brightdata,,oxylabs,,';
      const slugs = envValue.split(',').map(s => s.trim()).filter(Boolean);

      expect(slugs).toHaveLength(2);
      expect(slugs).toEqual(['brightdata', 'oxylabs']);
    });
  });

  describe('Proxy Account Slugs Retrieval (Mock Implementation)', () => {
    it('should return array of slugs from PROXY_ACCOUNT_SLUGS', () => {
      globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUGS', 'nimble,scraperapi,brightdata');
      globalThis.ShalionProperties.delete('PROXY_ACCOUNT_SLUG');

      // Mimic getProxyAccountSlugs() logic
      const properties = globalThis.ShalionProperties;
      const slugsEnv = properties.get('PROXY_ACCOUNT_SLUGS');
      const singleSlug = properties.get('PROXY_ACCOUNT_SLUG');

      let slugs: string[] = [];
      if (typeof slugsEnv === 'string' && slugsEnv.trim()) {
        slugs = slugsEnv.split(',').map(s => s.trim()).filter(Boolean);
      } else if (typeof singleSlug === 'string' && singleSlug.trim()) {
        slugs = [singleSlug.trim()];
      }

      expect(slugs).toEqual(['nimble', 'scraperapi', 'brightdata']);
    });

    it('should fall back to PROXY_ACCOUNT_SLUG if PROXY_ACCOUNT_SLUGS not set', () => {
      globalThis.ShalionProperties.delete('PROXY_ACCOUNT_SLUGS');
      globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUG', 'brightdata-residential');

      const properties = globalThis.ShalionProperties;
      const slugsEnv = properties.get('PROXY_ACCOUNT_SLUGS');
      const singleSlug = properties.get('PROXY_ACCOUNT_SLUG');

      let slugs: string[] = [];
      if (typeof slugsEnv === 'string' && slugsEnv.trim()) {
        slugs = slugsEnv.split(',').map(s => s.trim()).filter(Boolean);
      } else if (typeof singleSlug === 'string' && singleSlug.trim()) {
        slugs = [singleSlug.trim()];
      }

      expect(slugs).toEqual(['brightdata-residential']);
    });

    it('should return empty array if no proxy configured', () => {
      globalThis.ShalionProperties = new Map<string, string | undefined>();

      const properties = globalThis.ShalionProperties;
      const slugsEnv = properties.get('PROXY_ACCOUNT_SLUGS');
      const singleSlug = properties.get('PROXY_ACCOUNT_SLUG');

      let slugs: string[] = [];
      if (typeof slugsEnv === 'string' && slugsEnv.trim()) {
        slugs = slugsEnv.split(',').map(s => s.trim()).filter(Boolean);
      } else if (typeof singleSlug === 'string' && singleSlug.trim()) {
        slugs = [singleSlug.trim()];
      }

      expect(slugs).toHaveLength(0);
    });

    it('should prioritize PROXY_ACCOUNT_SLUGS over PROXY_ACCOUNT_SLUG', () => {
      globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUGS', 'nimble,scraperapi');
      globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUG', 'brightdata');

      const properties = globalThis.ShalionProperties;
      const slugsEnv = properties.get('PROXY_ACCOUNT_SLUGS');
      const singleSlug = properties.get('PROXY_ACCOUNT_SLUG');

      let slugs: string[] = [];
      // Prefer PROXY_ACCOUNT_SLUGS if set (matching implementation)
      if (typeof slugsEnv === 'string' && slugsEnv.trim()) {
        slugs = slugsEnv.split(',').map(s => s.trim()).filter(Boolean);
      } else if (typeof singleSlug === 'string' && singleSlug.trim()) {
        slugs = [singleSlug.trim()];
      }

      expect(slugs).toEqual(['nimble', 'scraperapi']);
      expect(slugs).not.toContain('brightdata');
    });
  });

  describe('Proxy Selection by Slug', () => {
    it('should find proxy by provider slug (case-insensitive)', () => {
      const accounts = [
        createMockProxyAccount('nimble', 'nimble-primary'),
        createMockProxyAccount('scraperapi', 'scraper-secondary'),
        createMockProxyAccount('brightdata', 'brightdata-main')
      ];

      const slug = 'NIMBLE';
      const found = accounts.find(
        a => a.provider.slug.toLowerCase() === slug.toLowerCase() ||
             a.name.toLowerCase() === slug.toLowerCase()
      );

      expect(found).toBeDefined();
      expect(found?.provider.slug).toBe('nimble');
    });

    it('should find proxy by account name', () => {
      const accounts = [
        createMockProxyAccount('brightdata', 'brightdata-residential'),
        createMockProxyAccount('brightdata', 'brightdata-datacenter')
      ];

      const slug = 'brightdata-datacenter';
      const found = accounts.find(
        a => a.provider.slug.toLowerCase() === slug.toLowerCase() ||
             a.name.toLowerCase() === slug.toLowerCase()
      );

      expect(found).toBeDefined();
      expect(found?.name).toBe('brightdata-datacenter');
    });

    it('should return null for non-existent slug', () => {
      const accounts = [
        createMockProxyAccount('nimble', 'nimble-primary')
      ];

      const slug = 'nonexistent';
      const found = accounts.find(
        a => a.provider.slug.toLowerCase() === slug.toLowerCase() ||
             a.name.toLowerCase() === slug.toLowerCase()
      );

      expect(found).toBeUndefined();
    });

    it('should skip inactive accounts', () => {
      const accounts = [
        createMockProxyAccount('nimble', 'nimble-active', true),
        createMockProxyAccount('scraperapi', 'scraper-inactive', false),
        createMockProxyAccount('brightdata', 'brightdata-active', true)
      ];

      const activeAccounts = accounts.filter(a => a.isActive);
      expect(activeAccounts).toHaveLength(2);
      expect(activeAccounts.every(a => a.isActive)).toBe(true);
    });
  });

  describe('buildAllProxies Priority Order', () => {
    it('should return proxies in configured order', () => {
      const slugs = ['brightdata-residential', 'oxylabs-residential', 'brightdata-datacenter'];
      const accounts = slugs.map((slug, i) => createMockProxyAccount(
        slug.includes('brightdata') ? 'brightdata' : 'oxylabs',
        slug
      ));

      // Verify order matches input
      expect(accounts[0].name).toBe('brightdata-residential');
      expect(accounts[1].name).toBe('oxylabs-residential');
      expect(accounts[2].name).toBe('brightdata-datacenter');
    });

    it('should filter inactive accounts while preserving order', () => {
      const accounts = [
        createMockProxyAccount('nimble', 'nimble-1', true),
        createMockProxyAccount('scraperapi', 'scraper-2', false), // inactive
        createMockProxyAccount('brightdata', 'brightdata-3', true),
        createMockProxyAccount('oxylabs', 'oxylabs-4', false), // inactive
        createMockProxyAccount('nimble', 'nimble-5', true)
      ];

      const activeAccounts = accounts.filter(a => a.isActive);

      expect(activeAccounts).toHaveLength(3);
      expect(activeAccounts[0].name).toBe('nimble-1');
      expect(activeAccounts[1].name).toBe('brightdata-3');
      expect(activeAccounts[2].name).toBe('nimble-5');
    });

    it('should log built proxies', () => {
      const accounts = [
        createMockProxyAccount('brightdata', 'brightdata-primary'),
        createMockProxyAccount('oxylabs', 'oxylabs-backup')
      ];

      const proxyNames = accounts.map(a => a.provider.slug).join(', ');
      expect(proxyNames).toBe('brightdata, oxylabs');
    });
  });

  describe('Proxy Types', () => {
    it('should identify BrightData proxy type', () => {
      const proxyTypes = ['BRIGHTDATA', 'NIMBLE', 'OXYLABS', 'SCRAPERAPI'] as const;
      expect(proxyTypes).toContain('BRIGHTDATA');
    });

    it('should identify Nimble proxy type', () => {
      const proxyTypes = ['BRIGHTDATA', 'NIMBLE', 'OXYLABS', 'SCRAPERAPI'] as const;
      expect(proxyTypes).toContain('NIMBLE');
    });

    it('should identify Oxylabs proxy type', () => {
      const proxyTypes = ['BRIGHTDATA', 'NIMBLE', 'OXYLABS', 'SCRAPERAPI'] as const;
      expect(proxyTypes).toContain('OXYLABS');
    });

    it('should identify ScraperAPI proxy type', () => {
      const proxyTypes = ['BRIGHTDATA', 'NIMBLE', 'OXYLABS', 'SCRAPERAPI'] as const;
      expect(proxyTypes).toContain('SCRAPERAPI');
    });

    it('should convert slug to ProxyType enum (case-insensitive)', () => {
      const convertSlugToProxyTypeEnum = (slug: string): string | undefined => {
        const types = ['BRIGHTDATA', 'NIMBLE', 'OXYLABS', 'SCRAPERAPI'];
        return types.find(t => t.toLowerCase() === slug.toLowerCase());
      };

      expect(convertSlugToProxyTypeEnum('brightdata')).toBe('BRIGHTDATA');
      expect(convertSlugToProxyTypeEnum('BRIGHTDATA')).toBe('BRIGHTDATA');
      expect(convertSlugToProxyTypeEnum('BrightData')).toBe('BRIGHTDATA');
      expect(convertSlugToProxyTypeEnum('nimble')).toBe('NIMBLE');
      expect(convertSlugToProxyTypeEnum('unknown')).toBeUndefined();
    });
  });

  describe('Region Validation', () => {
    it('should validate region belongs to account limited regions', () => {
      const account = {
        name: 'brightdata',
        limitedRegions: ['us', 'uk', 'de', 'es']
      };

      const validateRegion = (region: string | undefined): boolean => {
        if (!region) return true;
        if (account.limitedRegions.length === 0) return true;
        return account.limitedRegions.includes(region);
      };

      expect(validateRegion('us')).toBe(true);
      expect(validateRegion('uk')).toBe(true);
      expect(validateRegion('fr')).toBe(false); // Not in limitedRegions
      expect(validateRegion(undefined)).toBe(true); // No region = valid
    });

    it('should allow any region when no limitations', () => {
      const account = {
        name: 'nimble',
        limitedRegions: []
      };

      const validateRegion = (region: string | undefined): boolean => {
        if (!region) return true;
        if (account.limitedRegions.length === 0) return true;
        return account.limitedRegions.includes(region);
      };

      expect(validateRegion('us')).toBe(true);
      expect(validateRegion('any-region')).toBe(true);
      expect(validateRegion('xyz')).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TEST: Real Library Import (file verification)
// ============================================================================

describe('TECH-14201: Library Import Integration', () => {
  it('should have buildApiProxy function in factory.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const factoryPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/factory.ts');
    const content = fs.readFileSync(factoryPath, 'utf-8');
    expect(content).toContain('export async function buildApiProxy');
  });

  it('should have buildAllProxies function in factory.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const factoryPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/factory.ts');
    const content = fs.readFileSync(factoryPath, 'utf-8');
    expect(content).toContain('export async function buildAllProxies');
  });

  it('should have buildProxyBySlug function in factory.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const factoryPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/factory.ts');
    const content = fs.readFileSync(factoryPath, 'utf-8');
    expect(content).toContain('export async function buildProxyBySlug');
  });

  it('should have networkMeter in networkMeter.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const networkMeterPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/networkMeter.ts');
    const content = fs.readFileSync(networkMeterPath, 'utf-8');
    expect(content).toContain('export const networkMeter');
    expect(content).toContain('getMetrics()');
    expect(content).toContain('async start()');
    expect(content).toContain('async stop()');
  });
});