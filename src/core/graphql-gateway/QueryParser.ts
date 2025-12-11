import { GraphQLGatewayRequest, ParsedQuery } from './types';

/**
 * QueryParser - Parses GraphQL queries and extracts metadata
 */
export class QueryParser {
  /**
   * Parse a GraphQL query and extract operation details
   */
  public parseQuery(request: GraphQLGatewayRequest): ParsedQuery {
    const query = request.query.trim();
    
    // Extract operation type
    const operationType = this.extractOperationType(query);
    
    // Extract operation name
    const operationName = request.operationName || this.extractOperationName(query);
    
    // Extract fields
    const fields = this.extractFields(query);
    
    // Calculate depth
    const depth = this.calculateDepth(query);
    
    // Calculate complexity (simplified)
    const complexity = this.estimateComplexity(query, operationName);
    
    return {
      operationName,
      operationType,
      fields,
      depth,
      complexity,
      rawQuery: query,
    };
  }
  
  private extractOperationType(query: string): 'query' | 'mutation' | 'subscription' {
    const trimmed = query.trim();
    if (trimmed.startsWith('mutation')) return 'mutation';
    if (trimmed.startsWith('subscription')) return 'subscription';
    return 'query';
  }
  
  private extractOperationName(query: string): string | undefined {
    // Match: query MyQuery { ... } or mutation CreateUser { ... }
    const match = query.match(/(?:query|mutation|subscription)\s+([a-zA-Z0-9_]+)/);
    return match ? match[1] : undefined;
  }
  
  private extractFields(query: string): string[] {
    const fields: string[] = [];
    // Simple regex to find field names (words before '{' or '(')
    const fieldPattern = /([a-zA-Z0-9_]+)\s*(?:\(|\{)/g;
    let match;
    while ((match = fieldPattern.exec(query)) !== null) {
      fields.push(match[1]);
    }
    return fields.length > 0 ? fields : ['unknown'];
  }
  
  private calculateDepth(query: string): number {
    let depth = 0;
    let maxDepth = 0;
    for (const ch of query) {
      if (ch === '{') {
        depth += 1;
        maxDepth = Math.max(maxDepth, depth);
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
    }
    return maxDepth;
  }
  
  private estimateComplexity(query: string, operationName?: string): number {
    // Heuristic: field count * depth multiplier * operation weight
    const fieldMatches = query.match(/[a-zA-Z0-9_]+(\s*[({])/g);
    const fieldCount = fieldMatches ? fieldMatches.length : 5;
    const depth = this.calculateDepth(query);
    const opWeight = operationName ? Math.max(1, operationName.length % 5) : 1;
    return Math.round(fieldCount * (1 + depth * 0.5) * opWeight * 10);
  }
}

