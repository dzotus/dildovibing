import { ParsedQuery } from './types';

interface CacheEntry {
  query: string;
  response: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * CacheManager - Manages query result caching
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;
  private persistQueries: boolean;
  
  constructor(cacheTtl: number = 0, persistQueries: boolean = false) {
    this.ttl = cacheTtl;
    this.persistQueries = persistQueries;
  }
  
  /**
   * Generate cache key from query
   */
  private generateCacheKey(query: string, variables?: Record<string, unknown>): string {
    const varStr = variables ? JSON.stringify(variables) : '';
    return this.hashString(query + varStr);
  }
  
  /**
   * Check if query is cached and valid
   */
  public getCached(query: string, variables?: Record<string, unknown>): {
    hit: boolean;
    latencyReduction: number;
  } {
    if (this.ttl <= 0 || !this.persistQueries) {
      return { hit: false, latencyReduction: 0 };
    }
    
    const key = this.generateCacheKey(query, variables);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return { hit: false, latencyReduction: 0 };
    }
    
    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      return { hit: false, latencyReduction: 0 };
    }
    
    // Cache hit - return latency reduction factor
    // Cache hits are much faster (70% reduction)
    return { hit: true, latencyReduction: 0.7 };
  }
  
  /**
   * Store query result in cache
   */
  public setCached(
    query: string,
    response: unknown,
    variables?: Record<string, unknown>
  ): void {
    if (this.ttl <= 0 || !this.persistQueries) {
      return;
    }
    
    const key = this.generateCacheKey(query, variables);
    this.cache.set(key, {
      query,
      response,
      timestamp: Date.now(),
      ttl: this.ttl,
    });
    
    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  /**
   * Calculate cache hit probability based on query complexity
   */
  public getCacheHitProbability(parsedQuery: ParsedQuery): number {
    if (this.ttl <= 0 || !this.persistQueries) {
      return 0;
    }
    
    // More complex queries are less likely to be cached
    // Simple queries have higher cache hit rate
    const baseRate = 0.2;
    const complexityFactor = Math.min(parsedQuery.complexity / 2000, 0.4);
    return Math.min(baseRate + complexityFactor, 0.6);
  }
  
  public updateConfig(cacheTtl?: number, persistQueries?: boolean): void {
    if (cacheTtl !== undefined) this.ttl = cacheTtl;
    if (persistQueries !== undefined) this.persistQueries = persistQueries;
  }
  
  public clearCache(): void {
    this.cache.clear();
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

