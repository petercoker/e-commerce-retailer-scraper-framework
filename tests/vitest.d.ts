/// <reference types="vitest/globals" />

// Type declarations for javascript-commons imports
declare module '*javascript-commons/packages/proxy/dist/metrics/sourceMetrics.js' {
  export interface TransmissionMetrics {
    averageValue: number;
    sizeUnitName: 'bytes';
    timeUnitName: 'seconds';
  }

  export interface LatencyMetrics {
    minMs: number;
    maxMs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    sampleCount: number;
  }

  export interface ErrorMetrics {
    errorCount: number;
    errorRate: number;
    lastError?: string;
    lastErrorMessage?: string;
    errorTypes: Record<string, number>;
  }

  export interface SourceMetrics {
    source: string;
    requests: number;
    bandwidthBytes: number;
    bytesRead: number;
    bytesWritten: number;
    transmissionMetrics: TransmissionMetrics;
    latencyMs?: LatencyMetrics;
    errors?: ErrorMetrics;
  }

  export const DIRECT_SOURCE: string;
}