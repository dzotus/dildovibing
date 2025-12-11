import { ParsedQuery } from './types';

/**
 * QueryComplexityAnalyzer - Analyzes query complexity and validates against limits
 */
export class QueryComplexityAnalyzer {
  private maxQueryDepth: number;
  private maxQueryComplexity: number;
  private enabled: boolean;
  
  constructor(maxQueryDepth: number = 15, maxQueryComplexity: number = 1000, enabled: boolean = true) {
    this.maxQueryDepth = maxQueryDepth;
    this.maxQueryComplexity = maxQueryComplexity;
    this.enabled = enabled;
  }
  
  /**
   * Validate query against complexity and depth limits
   */
  public validateQuery(parsedQuery: ParsedQuery): { valid: boolean; error?: string } {
    if (!this.enabled) {
      return { valid: true };
    }
    
    if (parsedQuery.depth > this.maxQueryDepth) {
      return {
        valid: false,
        error: `Query depth ${parsedQuery.depth} exceeds limit ${this.maxQueryDepth}`,
      };
    }
    
    if (parsedQuery.complexity > this.maxQueryComplexity) {
      return {
        valid: false,
        error: `Query complexity ${parsedQuery.complexity} exceeds limit ${this.maxQueryComplexity}`,
      };
    }
    
    return { valid: true };
  }
  
  public updateLimits(maxQueryDepth?: number, maxQueryComplexity?: number) {
    if (maxQueryDepth !== undefined) this.maxQueryDepth = maxQueryDepth;
    if (maxQueryComplexity !== undefined) this.maxQueryComplexity = maxQueryComplexity;
  }
  
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

