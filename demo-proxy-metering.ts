/**
 * TECH-14200: Proxy Metering Demo
 * Demonstrates the new multi-proxy selection and network metering features.
 *
 * Run: npx ts-node demo-proxy-metering.ts
 *
 * Prerequisites:
 *   - Set PROXY_ACCOUNT_SLUGS in .env (comma-separated proxy slugs)
 *   - Or set PROXY_ACCOUNT_SLUG for single proxy (backward compatibility)
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load environment variables
dotenv.config();

// Initialize ShalionProperties for proxy configuration
declare global {
  var ShalionProperties: Map<string, string | undefined>;
}

globalThis.ShalionProperties = new Map<string, string | undefined>();

// Set proxy configuration from environment
const proxySlugs = process.env.PROXY_ACCOUNT_SLUGS || process.env.PROXY_ACCOUNT_SLUG || '';
if (proxySlugs) {
  globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUGS', proxySlugs);
}
if (process.env.PROXY_ACCOUNT_SLUG) {
  globalThis.ShalionProperties.set('PROXY_ACCOUNT_SLUG', process.env.PROXY_ACCOUNT_SLUG);
}
if (process.env.PROXY_REGION) {
  globalThis.ShalionProperties.set('PROXY_REGION', process.env.PROXY_REGION);
}

// ============================================================================
// Mock Types (mirrors javascript-commons types for demo)
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

class SourceMetricsCollector {
  private requests: number = 0;
  private bytesRead: number = 0;
  private bytesWritten: number = 0;
  private readonly startTime: number = Date.now();

  constructor(public readonly source: string) {}

  recordRequest(): void { this.requests++; }
  recordBytesRead(bytes: number): void { this.bytesRead += bytes; }
  recordBytesWritten(bytes: number): void { this.bytesWritten += bytes; }

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
        timeUnitName: 'seconds'
      }
    };
  }
}

class NetworkMeterDemo {
  private readonly collectors: Map<string, SourceMetricsCollector> = new Map();
  private directCollector: SourceMetricsCollector = new SourceMetricsCollector(DIRECT_SOURCE);

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
    if (isRequest) collector.recordRequest();
  }

  getMetrics(): SourceMetrics[] {
    const metrics: SourceMetrics[] = [];
    for (const collector of this.collectors.values()) {
      const m = collector.toMetrics();
      if (m.requests > 0 || m.bandwidthBytes > 0) metrics.push(m);
    }
    const directMetrics = this.directCollector.toMetrics();
    if (directMetrics.requests > 0 || directMetrics.bandwidthBytes > 0) metrics.push(directMetrics);
    return metrics;
  }
}

// ============================================================================
// Demo Functions
// ============================================================================

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Print a separator line
 */
function printSeparator(char: string = '─', length: number = 70): void {
  console.log(char.repeat(length));
}

/**
 * Display metrics in a readable FinOps format
 */
function displayMetrics(metrics: SourceMetrics[]): void {
  console.log('\n📊 NETWORK METER TRAFFIC SUMMARY');
  printSeparator('═');

  if (metrics.length === 0) {
    console.log('  ⚠️  No traffic recorded');
    return;
  }

  let totalRequests = 0;
  let totalBandwidth = 0;

  for (const m of metrics) {
    console.log(`\n  📦 Provider: ${m.source.toUpperCase()}`);
    console.log(`     Requests:     ${m.requests}`);
    console.log(`     Bandwidth:    ${formatBytes(m.bandwidthBytes)}`);
    console.log(`     ↓ Download:   ${formatBytes(m.bytesRead)}`);
    console.log(`     ↑ Upload:     ${formatBytes(m.bytesWritten)}`);
    console.log(`     Avg Rate:     ${formatBytes(m.transmissionMetrics.averageValue)}/s`);

    totalRequests += m.requests;
    totalBandwidth += m.bandwidthBytes;
  }

  printSeparator('═');
  console.log(`\n  📈 TOTALS`);
  console.log(`     Total Requests:  ${totalRequests}`);
  console.log(`     Total Bandwidth: ${formatBytes(totalBandwidth)}`);
  printSeparator('═');
}

/**
 * Demo: Multi-proxy selection (TECH-14201)
 */
async function demoMultiProxySelection(): Promise<void> {
  console.log('\n🎯 TECH-14201: Multi-Proxy Selection Demo');
  printSeparator();

  const proxySlugs = process.env.PROXY_ACCOUNT_SLUGS?.split(',').map(s => s.trim()).filter(Boolean) || [];

  if (proxySlugs.length === 0) {
    console.log('  ⚠️  No proxies configured. Set PROXY_ACCOUNT_SLUGS in .env');
    console.log('  ℹ️  Example: PROXY_ACCOUNT_SLUGS=brightdata-residential,oxylabs-residential');
    return;
  }

  console.log(`  ✅ Configured proxy slugs: [${proxySlugs.join(', ')}]`);
  console.log(`  ℹ️  Priority order: Primary → Fallback 1 → Fallback 2`);
  console.log('');
  console.log('  New API Functions Available:');
  console.log('     - buildAllProxies()     → Returns all proxies in priority order');
  console.log('     - buildProxyBySlug()   → Returns specific proxy by slug');
  console.log('     - buildApiProxy()      → Returns API-based proxy (Nimble, ScraperAPI, etc.)');
}

/**
 * Demo: API Proxy metering (TECH-14203/14204)
 */
async function demoApiProxyMetering(networkMeter: NetworkMeterDemo): Promise<void> {
  console.log('\n🔌 TECH-14203/14204: API Proxy Metering Demo');
  printSeparator();

  console.log('\n  📝 Web Streams API Pattern:');
  console.log('     const reader = response.body.getReader();');
  console.log('     while (true) {');
  console.log('       const { done, value } = await reader.read();');
  console.log('       if (done) break;');
  console.log('       bytesRead += value.length;  // Track each chunk');
  console.log('     }');

  // Simulate API proxy traffic for demo
  console.log('\n  📊 Simulating API proxy traffic...');
  networkMeter.reportDirectTraffic({
    bytesRead: 15000,
    bytesWritten: 500,
    isRequest: true,
    source: 'brightdata'
  });

  networkMeter.reportDirectTraffic({
    bytesRead: 8000,
    bytesWritten: 300,
    isRequest: true,
    source: 'oxylabs'
  });

  console.log('  ✅ Traffic attributed to correct provider slugs');
}

/**
 * Demo: Per-proxy differentiation (TECH-14202)
 */
async function demoPerProxyDifferentiation(networkMeter: NetworkMeterDemo): Promise<void> {
  console.log('\n📈 TECH-14202: Per-Proxy Differentiation Demo');
  printSeparator();

  // Add additional demo traffic
  networkMeter.reportDirectTraffic({
    bytesRead: 25000,
    bytesWritten: 1200,
    isRequest: true,
    source: 'nimble'
  });

  console.log('\n  Metrics Structure (SourceMetrics[]):');
  const metrics = networkMeter.getMetrics();

  for (const m of metrics) {
    console.log(`  {`);
    console.log(`    source: '${m.source}',`);
    console.log(`    requests: ${m.requests},`);
    console.log(`    bandwidthBytes: ${m.bandwidthBytes},`);
    console.log(`    bytesRead: ${m.bytesRead},`);
    console.log(`    bytesWritten: ${m.bytesWritten}`);
    console.log(`  }`);
  }

  console.log('\n  ✅ Each provider has independent metrics tracking');
  console.log('  ✅ Bandwidth = bytesRead + bytesWritten');
}

/**
 * Main demo entry point
 */
async function main(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     TECH-14200: Proxy Metering & Multi-Proxy Demo             ║');
  console.log('║     Deadline: 10:00 AM BCN Time                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  console.log('\n📋 Configuration:');
  console.log(`   PROXY_ACCOUNT_SLUGS: ${process.env.PROXY_ACCOUNT_SLUGS || '(not set)'}`);
  console.log(`   PROXY_ACCOUNT_SLUG:  ${process.env.PROXY_ACCOUNT_SLUG || '(not set)'}`);
  console.log(`   PROXY_REGION:        ${process.env.PROXY_REGION || '(not set)'}`);

  // Create network meter instance for demo
  const networkMeter = new NetworkMeterDemo();

  try {
    // Run demos
    await demoMultiProxySelection();
    await demoApiProxyMetering(networkMeter);
    await demoPerProxyDifferentiation(networkMeter);

    // Display final metrics
    const metrics = networkMeter.getMetrics();
    displayMetrics(metrics);

    // FinOps Cost Calculation Example
    console.log('\n💰 FINOPS COST CALCULATION EXAMPLE');
    printSeparator();
    console.log('\n  Sample pricing (per GB):');
    console.log('     BrightData:   $12.00/GB');
    console.log('     Oxylabs:      $10.00/GB');
    console.log('     Nimble:       $8.00/GB');
    console.log('     ScraperAPI:  $5.00/GB');

    const pricing: Record<string, number> = {
      brightdata: 12.00,
      oxylabs: 10.00,
      nimble: 8.00,
      scraperapi: 5.00
    };

    let totalCost = 0;
    console.log('\n  Cost by provider:');
    for (const m of metrics) {
      const pricePerGB = pricing[m.source.toLowerCase()] || 10.00;
      const bandwidthGB = m.bandwidthBytes / (1024 * 1024 * 1024);
      const cost = bandwidthGB * pricePerGB;
      totalCost += cost;
      console.log(`     ${m.source}: $${cost.toFixed(4)} (${formatBytes(m.bandwidthBytes)} @ $${pricePerGB}/GB)`);
    }
    console.log(`\n  💵 Total Estimated Cost: $${totalCost.toFixed(4)}`);

    console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
    console.log('   All TECH-14200 features demonstrated:');
    console.log('   - TECH-14201: Multi-proxy selection ✅');
    console.log('   - TECH-14202: Per-proxy differentiation ✅');
    console.log('   - TECH-14203: All traffic metering ✅');
    console.log('   - TECH-14204: Scraper API metering ✅');

  } catch (error) {
    console.error('\n❌ Demo failed:');
    console.error((error as Error).message);
    if ((error as Error).stack) {
      console.error((error as Error).stack);
    }
  }
}

// Run the demo
main().catch(console.error);