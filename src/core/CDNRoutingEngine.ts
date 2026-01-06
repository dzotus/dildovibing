/**
 * CDN Routing Engine
 * Simulates CDN request routing, caching, and edge location behavior
 */

import { CanvasNode } from '@/types';

/**
 * CDN Distribution Configuration
 */
export interface CDNDistribution {
  id: string;
  domain: string;
  origin: string;
  status: 'deployed' | 'deploying' | 'failed';
  edgeLocations?: number;
  cachePolicy?: 'cache-first' | 'origin-first' | 'bypass';
  defaultTTL?: number;
  maxTTL?: number;
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'brotli' | 'zstd';
  enableHTTP2?: boolean;
  enableHTTP3?: boolean;
  enableHTTPS?: boolean;
  enableGeoRouting?: boolean;
  enableDDoSProtection?: boolean;
}

/**
 * Edge Location Configuration
 */
export interface EdgeLocation {
  id: string;
  region: string;
  city: string;
  status: 'active' | 'inactive';
  capacity?: number; // requests per second
  latency?: number; // ms to origin
}

/**
 * CDN Request
 */
export interface CDNRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  domain: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  clientIP?: string;
  userAgent?: string;
  timestamp: number;
}

/**
 * CDN Response
 */
export interface CDNResponse {
  status: number;
  headers: Record<string, string>;
  body?: any;
  cacheHit: boolean;
  servedFrom: 'cache' | 'origin' | 'edge';
  edgeLocation?: string;
  latency: number;
  size: number;
}

/**
 * CDN Cache Entry
 */
interface CDNCacheEntry {
  key: string;
  data: any;
  headers: Record<string, string>;
  expiresAt: number;
  size: number;
  hitCount: number;
  lastAccessed: number;
}

/**
 * CDN Routing Engine Statistics
 */
export interface CDNStats {
  totalRequests: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  totalBandwidth: number; // bytes
  totalErrors: number;
  averageLatency: number;
  averageCacheHitRate: number;
  requestsPerSecond: number;
  bandwidthPerSecond: number; // bytes/sec
  errorRate: number;
  distributions: Map<string, {
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    bandwidth: number;
    errors: number;
  }>;
  edgeLocations: Map<string, {
    requests: number;
    cacheHits: number;
    bandwidth: number;
    latency: number;
  }>;
}

/**
 * CDN Routing Engine
 * Handles request routing, caching, and edge location selection
 */
export class CDNRoutingEngine {
  private distributions: Map<string, CDNDistribution> = new Map();
  private edgeLocations: Map<string, EdgeLocation> = new Map();
  private cache: Map<string, CDNCacheEntry> = new Map();
  private stats: CDNStats;
  private requestHistory: Array<{ timestamp: number; size: number }> = [];
  private readonly MAX_CACHE_SIZE = 1000; // Maximum cache entries
  private readonly MAX_HISTORY_SIZE = 1000; // Maximum history entries

  constructor() {
    this.stats = {
      totalRequests: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalBandwidth: 0,
      totalErrors: 0,
      averageLatency: 0,
      averageCacheHitRate: 0,
      requestsPerSecond: 0,
      bandwidthPerSecond: 0,
      errorRate: 0,
      distributions: new Map(),
      edgeLocations: new Map(),
    };
  }

  /**
   * Initialize CDN configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;

    // Initialize distributions
    const distributions = config.distributions || [];
    this.distributions.clear();
    for (const dist of distributions) {
      this.distributions.set(dist.id, {
        id: dist.id,
        domain: dist.domain,
        origin: dist.origin,
        status: dist.status || 'deployed',
        edgeLocations: dist.edgeLocations || 0,
        cachePolicy: dist.cachePolicy || config.cachePolicy || 'cache-first',
        defaultTTL: dist.defaultTTL || config.defaultTTL || 3600,
        maxTTL: dist.maxTTL || config.maxTTL || 86400,
        enableCompression: dist.enableCompression ?? config.enableCompression ?? true,
        compressionType: dist.compressionType || config.compressionType || 'gzip',
        enableHTTP2: dist.enableHTTP2 ?? config.enableHTTP2 ?? true,
        enableHTTP3: dist.enableHTTP3 ?? config.enableHTTP3 ?? false,
        enableHTTPS: dist.enableHTTPS ?? config.enableHTTPS ?? true,
        enableGeoRouting: dist.enableGeoRouting ?? config.enableGeoRouting ?? false,
        enableDDoSProtection: dist.enableDDoSProtection ?? config.enableDDoSProtection ?? true,
      });
    }

    // Initialize edge locations
    const edgeLocations = config.edgeLocations || [];
    this.edgeLocations.clear();
    for (const location of edgeLocations) {
      this.edgeLocations.set(location.id, {
        id: location.id,
        region: location.region,
        city: location.city,
        status: location.status || 'active',
        capacity: location.capacity || 10000,
        latency: location.latency || 50,
      });
    }

    // Initialize stats for distributions
    for (const distId of this.distributions.keys()) {
      this.stats.distributions.set(distId, {
        requests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        bandwidth: 0,
        errors: 0,
      });
    }

    // Initialize stats for edge locations
    for (const locId of this.edgeLocations.keys()) {
      this.stats.edgeLocations.set(locId, {
        requests: 0,
        cacheHits: 0,
        bandwidth: 0,
        latency: 0,
      });
    }
  }

  /**
   * Process a CDN request
   */
  public processRequest(request: CDNRequest): CDNResponse {
    const startTime = Date.now();
    this.stats.totalRequests++;

    // Find distribution by domain
    const distribution = Array.from(this.distributions.values())
      .find(d => d.domain === request.domain && d.status === 'deployed');

    if (!distribution) {
      this.stats.totalErrors++;
      return {
        status: 404,
        headers: {},
        cacheHit: false,
        servedFrom: 'origin',
        latency: Date.now() - startTime,
        size: 0,
      };
    }

    // Update distribution stats
    const distStats = this.stats.distributions.get(distribution.id);
    if (distStats) {
      distStats.requests++;
    }

    // Select edge location (geo routing or nearest)
    const edgeLocation = this.selectEdgeLocation(request, distribution);
    if (edgeLocation) {
      const locStats = this.stats.edgeLocations.get(edgeLocation.id);
      if (locStats) {
        locStats.requests++;
      }
    }

    // Check cache (only for GET requests)
    let cacheHit = false;
    let cachedData: CDNCacheEntry | undefined;

    if (request.method === 'GET' && distribution.cachePolicy !== 'bypass') {
      const cacheKey = this.getCacheKey(request, distribution);
      cachedData = this.cache.get(cacheKey);

      if (cachedData && cachedData.expiresAt > Date.now()) {
        // Cache hit
        cacheHit = true;
        this.stats.totalCacheHits++;
        cachedData.hitCount++;
        cachedData.lastAccessed = Date.now();

        if (distStats) {
          distStats.cacheHits++;
        }
        if (edgeLocation) {
          const locStats = this.stats.edgeLocations.get(edgeLocation.id);
          if (locStats) {
            locStats.cacheHits++;
          }
        }
      } else {
        // Cache miss
        this.stats.totalCacheMisses++;
        if (distStats) {
          distStats.cacheMisses++;
        }
      }
    }

    // Calculate latency
    let latency = 0;
    if (cacheHit && cachedData) {
      // Cache hit: very low latency (edge location)
      latency = edgeLocation?.latency ? edgeLocation.latency * 0.1 : 5;
    } else {
      // Cache miss: fetch from origin
      latency = edgeLocation?.latency ? edgeLocation.latency * 2 : 100;
      // Add origin fetch time
      latency += 50 + Math.random() * 50; // 50-100ms origin latency
    }

    // Simulate compression if enabled
    let responseSize = cachedData?.size || 1024; // Default 1KB
    if (distribution.enableCompression && request.method === 'GET') {
      // Compression reduces size by 60-80%
      const compressionRatio = 0.3 + Math.random() * 0.2; // 0.3-0.5
      responseSize = Math.floor(responseSize * compressionRatio);
    }

    // Update bandwidth
    this.stats.totalBandwidth += responseSize;
    if (distStats) {
      distStats.bandwidth += responseSize;
    }
    if (edgeLocation) {
      const locStats = this.stats.edgeLocations.get(edgeLocation.id);
      if (locStats) {
        locStats.bandwidth += responseSize;
      }
    }

    // Store in cache if cache miss and cacheable
    if (!cacheHit && request.method === 'GET' && distribution.cachePolicy !== 'bypass') {
      const cacheKey = this.getCacheKey(request, distribution);
      const ttl = distribution.defaultTTL || 3600;
      this.cache.set(cacheKey, {
        key: cacheKey,
        data: { status: 200, body: 'cached' },
        headers: { 'content-type': 'application/json' },
        expiresAt: Date.now() + (ttl * 1000),
        size: responseSize,
        hitCount: 0,
        lastAccessed: Date.now(),
      });

      // Evict old entries if cache is full
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        this.evictCacheEntries();
      }
    }

    // Update request history
    this.requestHistory.push({
      timestamp: Date.now(),
      size: responseSize,
    });
    if (this.requestHistory.length > this.MAX_HISTORY_SIZE) {
      this.requestHistory.shift();
    }

    // Update stats
    this.updateStats();

    return {
      status: cacheHit ? 200 : 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': `max-age=${distribution.defaultTTL || 3600}`,
        'x-cache': cacheHit ? 'HIT' : 'MISS',
        'x-edge-location': edgeLocation?.city || 'unknown',
      },
      body: cacheHit ? cachedData?.data : { status: 'ok' },
      cacheHit,
      servedFrom: cacheHit ? 'cache' : 'origin',
      edgeLocation: edgeLocation?.city,
      latency,
      size: responseSize,
    };
  }

  /**
   * Select edge location for request (geo routing or nearest)
   */
  private selectEdgeLocation(request: CDNRequest, distribution: CDNDistribution): EdgeLocation | undefined {
    const activeLocations = Array.from(this.edgeLocations.values())
      .filter(loc => loc.status === 'active');

    if (activeLocations.length === 0) {
      return undefined;
    }

    // If geo routing is enabled, select based on client IP (simplified)
    if (distribution.enableGeoRouting && request.clientIP) {
      // Simplified geo routing: select based on IP hash
      const hash = this.hashString(request.clientIP);
      return activeLocations[hash % activeLocations.length];
    }

    // Otherwise, select nearest (lowest latency)
    return activeLocations.reduce((nearest, current) => {
      return (current.latency || 50) < (nearest.latency || 50) ? current : nearest;
    });
  }

  /**
   * Generate cache key from request
   */
  private getCacheKey(request: CDNRequest, distribution: CDNDistribution): string {
    // Cache key includes domain, path, and query string
    const queryString = request.query
      ? '?' + Object.entries(request.query).sort().map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    return `${distribution.id}:${request.method}:${request.path}${queryString}`;
  }

  /**
   * Evict old cache entries (LRU)
   */
  private evictCacheEntries(): void {
    const entries = Array.from(this.cache.entries());
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 10% of entries
    const toRemove = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    // Calculate average cache hit rate
    const totalCacheOps = this.stats.totalCacheHits + this.stats.totalCacheMisses;
    this.stats.averageCacheHitRate = totalCacheOps > 0
      ? this.stats.totalCacheHits / totalCacheOps
      : 0;

    // Calculate average latency (simplified)
    this.stats.averageLatency = 50; // Will be updated from actual requests

    // Calculate requests per second (from history)
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.requestHistory.filter(r => r.timestamp > oneSecondAgo);
    this.stats.requestsPerSecond = recentRequests.length;

    // Calculate bandwidth per second
    const recentBandwidth = recentRequests.reduce((sum, r) => sum + r.size, 0);
    this.stats.bandwidthPerSecond = recentBandwidth;

    // Calculate error rate
    this.stats.errorRate = this.stats.totalRequests > 0
      ? this.stats.totalErrors / this.stats.totalRequests
      : 0;
  }

  /**
   * Purge cache for a distribution or specific path
   */
  public purgeCache(distributionId?: string, path?: string): number {
    let purged = 0;

    if (distributionId && path) {
      // Purge specific path
      const prefix = `${distributionId}:`;
      for (const [key, entry] of this.cache.entries()) {
        if (key.startsWith(prefix) && key.includes(path)) {
          this.cache.delete(key);
          purged++;
        }
      }
    } else if (distributionId) {
      // Purge all for distribution
      const prefix = `${distributionId}:`;
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          purged++;
        }
      }
    } else {
      // Purge all
      purged = this.cache.size;
      this.cache.clear();
    }

    return purged;
  }

  /**
   * Get statistics
   */
  public getStats(): CDNStats {
    return { ...this.stats };
  }

  /**
   * Get distributions
   */
  public getDistributions(): CDNDistribution[] {
    return Array.from(this.distributions.values());
  }

  /**
   * Get edge locations
   */
  public getEdgeLocations(): EdgeLocation[] {
    return Array.from(this.edgeLocations.values());
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

