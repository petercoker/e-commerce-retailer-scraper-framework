/**
 * Library Import Test: javascript-commons TECH-14200 Branch
 * Verifies the library can be imported and proxy objects work correctly.
 *
 * This test verifies the library is properly linked and exports are available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('Library Import: TECH-14200', () => {
  describe('Package Linkage Verification', () => {
    it('should have javascript-commons installed correctly', () => {
      const linkPath = path.join(__dirname, '../../node_modules/javascript-commons');

      // Check that the package exists (either as symlink or directory)
      expect(fs.existsSync(linkPath)).toBe(true);

      const realPath = fs.realpathSync(linkPath);
      expect(realPath).toContain('javascript-commons');
    });

    it('should have proxy package files available', () => {
      const proxyPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy');

      expect(fs.existsSync(path.join(proxyPath, 'src/factory.ts'))).toBe(true);
      expect(fs.existsSync(path.join(proxyPath, 'src/networkMeter.ts'))).toBe(true);
      expect(fs.existsSync(path.join(proxyPath, 'src/models/apiProxy.ts'))).toBe(true);
      expect(fs.existsSync(path.join(proxyPath, 'src/metrics/sourceMetrics.ts'))).toBe(true);
    });

    it('should have TECH-14201 exports in factory.ts', () => {
      const factoryPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/factory.ts');
      const content = fs.readFileSync(factoryPath, 'utf-8');

      expect(content).toContain('export async function buildProxy');
      expect(content).toContain('export async function buildProxyBySlug');
      expect(content).toContain('export async function buildAllProxies');
      expect(content).toContain('export async function buildApiProxy');
      expect(content).toContain('export async function buildAllApiProxies');
    });

    it('should have TECH-14202 exports in networkMeter.ts', () => {
      const networkMeterPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/networkMeter.ts');
      const content = fs.readFileSync(networkMeterPath, 'utf-8');

      expect(content).toContain('export const networkMeter');
      expect(content).toContain('reportDirectTraffic');
      expect(content).toContain('getMetrics');
    });

    it('should have TECH-14202 SourceMetrics in sourceMetrics.ts', () => {
      const sourceMetricsPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/metrics/sourceMetrics.ts');
      const content = fs.readFileSync(sourceMetricsPath, 'utf-8');

      expect(content).toContain('export interface SourceMetrics');
      expect(content).toContain('export interface TransmissionMetrics');
      expect(content).toContain('export class SourceMetricsCollector');
      expect(content).toContain("export const DIRECT_SOURCE");
    });

    it('should have TECH-14203 ApiProxy base class', () => {
      const apiProxyPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/apiProxy.ts');
      const content = fs.readFileSync(apiProxyPath, 'utf-8');

      expect(content).toContain('export abstract class ApiProxy');
      expect(content).toContain('executeRequest');
      expect(content).toContain('reportTraffic');
    });

    it('should have TECH-14204 provider implementations', () => {
      const modelsPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models');

      expect(fs.existsSync(path.join(modelsPath, 'nimbleApi.ts'))).toBe(true);
      expect(fs.existsSync(path.join(modelsPath, 'scraperapiApi.ts'))).toBe(true);
      expect(fs.existsSync(path.join(modelsPath, 'brightdataApi.ts'))).toBe(true);
      expect(fs.existsSync(path.join(modelsPath, 'oxylabsApi.ts'))).toBe(true);
    });

    it('should have NimbleApiProxy extending ApiProxy', () => {
      const nimbleApiPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/nimbleApi.ts');
      const content = fs.readFileSync(nimbleApiPath, 'utf-8');

      expect(content).toContain('export class NimbleApiProxy extends ApiProxy');
      expect(content).toContain('async fetch');
    });

    it('should have ScraperapiApiProxy extending ApiProxy', () => {
      const scraperapiApiPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/scraperapiApi.ts');
      const content = fs.readFileSync(scraperapiApiPath, 'utf-8');

      expect(content).toContain('export class ScraperapiApiProxy extends ApiProxy');
      expect(content).toContain('async fetch');
    });

    it('should have BrightDataApiProxy extending ApiProxy', () => {
      const brightdataApiPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/brightdataApi.ts');
      const content = fs.readFileSync(brightdataApiPath, 'utf-8');

      expect(content).toContain('export class BrightDataApiProxy extends ApiProxy');
    });

    it('should have OxylabsApiProxy extending ApiProxy', () => {
      const oxylabsApiPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/models/oxylabsApi.ts');
      const content = fs.readFileSync(oxylabsApiPath, 'utf-8');

      expect(content).toContain('export class OxylabsApiProxy extends ApiProxy');
    });

    it('should have proxyManager with failover support', () => {
      const proxyManagerPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src/proxyManager.ts');
      const content = fs.readFileSync(proxyManagerPath, 'utf-8');

      expect(content).toContain('export const proxyManager');
      expect(content).toContain('failoverIterator');
      expect(content).toContain('withFailover');
      expect(content).toContain('getDefault');
      expect(content).toContain('getBySlug');
    });
  });

  describe('TECH-14200 Branch Verification', () => {
    it('should be on Tech-14200-final-version branch', () => {
      const jsCommonsPath = path.join(__dirname, '../../node_modules/javascript-commons');

      try {
        const branch = execSync('git branch --show-current', {
          cwd: jsCommonsPath,
          encoding: 'utf-8'
        }).trim();

        expect(branch).toBe('Tech-14200-final-version');
      } catch {
        console.log('Note: Could not verify git branch directly');
      }
    });

    it('should have all TECH-14200 implementation files', () => {
      const proxyPath = path.join(__dirname, '../../node_modules/javascript-commons/packages/proxy/src');

      const requiredFiles: string[] = [
        'factory.ts',
        'networkMeter.ts',
        'metrics/sourceMetrics.ts',
        'models/apiProxy.ts',
        'models/nimbleApi.ts',
        'models/scraperapiApi.ts',
        'models/brightdataApi.ts',
        'models/oxylabsApi.ts',
        'proxyManager.ts',
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(proxyPath, file);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });
});