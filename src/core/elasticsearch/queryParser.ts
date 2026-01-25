/**
 * Elasticsearch Query Parser
 * 
 * Парсит и выполняет Elasticsearch DSL запросы для симуляции.
 * Поддерживает основные типы запросов: bool, match, term, range, wildcard, exists.
 */

import type { Document } from './types';

export interface QueryMatchResult {
  matches: boolean;
  score?: number;
}

/**
 * Parse and execute Elasticsearch query
 */
export function parseAndExecuteQuery(query: any, documents: Document[]): Document[] {
  if (!query || !query.query) {
    return documents; // match_all by default
  }

  return executeQuery(query.query, documents);
}

/**
 * Execute query against documents
 */
function executeQuery(query: any, documents: Document[]): Document[] {
  if (query.match_all) {
    return documents;
  }

  if (query.bool) {
    return executeBoolQuery(query.bool, documents);
  }

  if (query.match) {
    return executeMatchQuery(query.match, documents);
  }

  if (query.term) {
    return executeTermQuery(query.term, documents);
  }

  if (query.range) {
    return executeRangeQuery(query.range, documents);
  }

  if (query.wildcard) {
    return executeWildcardQuery(query.wildcard, documents);
  }

  if (query.exists) {
    return executeExistsQuery(query.exists, documents);
  }

  // If no recognized query type, return all documents
  return documents;
}

/**
 * Execute bool query (must, should, must_not, filter)
 */
function executeBoolQuery(boolQuery: any, documents: Document[]): Document[] {
  let result = documents;

  // must - all must match
  if (boolQuery.must && Array.isArray(boolQuery.must)) {
    for (const mustQuery of boolQuery.must) {
      const mustResults = executeQuery(mustQuery, result);
      result = result.filter(doc => mustResults.includes(doc));
    }
  }

  // filter - same as must but doesn't affect score (we don't use scores in simulation)
  if (boolQuery.filter && Array.isArray(boolQuery.filter)) {
    for (const filterQuery of boolQuery.filter) {
      const filterResults = executeQuery(filterQuery, result);
      result = result.filter(doc => filterResults.includes(doc));
    }
  }

  // must_not - none should match
  if (boolQuery.must_not && Array.isArray(boolQuery.must_not)) {
    for (const mustNotQuery of boolQuery.must_not) {
      const mustNotResults = executeQuery(mustNotQuery, result);
      result = result.filter(doc => !mustNotResults.includes(doc));
    }
  }

  // should - at least one should match (if no must/filter, at least one should match)
  if (boolQuery.should && Array.isArray(boolQuery.should)) {
    if (boolQuery.must || boolQuery.filter) {
      // If there are must/filter clauses, should is optional
      const shouldResults: Document[] = [];
      for (const shouldQuery of boolQuery.should) {
        const shouldMatches = executeQuery(shouldQuery, result);
        shouldResults.push(...shouldMatches);
      }
      // Union with current result (should adds to result)
      const shouldSet = new Set(shouldResults);
      result = result.filter(doc => shouldSet.has(doc) || result.includes(doc));
    } else {
      // If no must/filter, at least one should must match
      const shouldResults: Document[] = [];
      for (const shouldQuery of boolQuery.should) {
        const shouldMatches = executeQuery(shouldQuery, result);
        shouldResults.push(...shouldMatches);
      }
      const shouldSet = new Set(shouldResults);
      result = result.filter(doc => shouldSet.has(doc));
    }
  }

  // minimum_should_match
  if (boolQuery.minimum_should_match !== undefined && boolQuery.should) {
    const shouldCount = boolQuery.should.length;
    const minShouldMatch = parseMinimumShouldMatch(boolQuery.minimum_should_match, shouldCount);
    
    const matchingDocs = new Map<Document, number>();
    for (const shouldQuery of boolQuery.should) {
      const shouldMatches = executeQuery(shouldQuery, result);
      for (const doc of shouldMatches) {
        matchingDocs.set(doc, (matchingDocs.get(doc) || 0) + 1);
      }
    }
    
    result = result.filter(doc => {
      const matchCount = matchingDocs.get(doc) || 0;
      return matchCount >= minShouldMatch;
    });
  }

  return result;
}

/**
 * Execute match query (text search)
 */
function executeMatchQuery(matchQuery: any, documents: Document[]): Document[] {
  const field = Object.keys(matchQuery)[0];
  if (!field) return documents;

  const queryValue = matchQuery[field];
  const searchText = typeof queryValue === 'string' ? queryValue : queryValue?.query || '';

  return documents.filter(doc => {
    const fieldValue = getNestedField(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const fieldStr = String(fieldValue).toLowerCase();
    const searchStr = searchText.toLowerCase();

    // Simple text matching (supports partial matches)
    return fieldStr.includes(searchStr);
  });
}

/**
 * Execute term query (exact match)
 */
function executeTermQuery(termQuery: any, documents: Document[]): Document[] {
  const field = Object.keys(termQuery)[0];
  if (!field) return documents;

  const termValue = termQuery[field];
  const searchValue = typeof termValue === 'object' && termValue.value !== undefined 
    ? termValue.value 
    : termValue;

  return documents.filter(doc => {
    const fieldValue = getNestedField(doc._source, field);
    
    // Exact match (case-sensitive for strings)
    if (fieldValue === searchValue) return true;
    
    // For arrays, check if any element matches
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(val => val === searchValue);
    }

    return false;
  });
}

/**
 * Execute range query
 */
function executeRangeQuery(rangeQuery: any, documents: Document[]): Document[] {
  const field = Object.keys(rangeQuery)[0];
  if (!field) return documents;

  const range = rangeQuery[field];

  return documents.filter(doc => {
    const fieldValue = getNestedField(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const numValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
    if (isNaN(numValue)) return false;

    // Check range conditions
    if (range.gte !== undefined && numValue < range.gte) return false;
    if (range.gt !== undefined && numValue <= range.gt) return false;
    if (range.lte !== undefined && numValue > range.lte) return false;
    if (range.lt !== undefined && numValue >= range.lt) return false;

    return true;
  });
}

/**
 * Execute wildcard query
 */
function executeWildcardQuery(wildcardQuery: any, documents: Document[]): Document[] {
  const field = Object.keys(wildcardQuery)[0];
  if (!field) return documents;

  const wildcardValue = wildcardQuery[field];
  const pattern = typeof wildcardValue === 'string' ? wildcardValue : wildcardValue?.value || '';

  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`, 'i');

  return documents.filter(doc => {
    const fieldValue = getNestedField(doc._source, field);
    if (fieldValue === undefined || fieldValue === null) return false;

    const fieldStr = String(fieldValue);
    return regex.test(fieldStr);
  });
}

/**
 * Execute exists query
 */
function executeExistsQuery(existsQuery: any, documents: Document[]): Document[] {
  const field = existsQuery.field;
  if (!field) return documents;

  return documents.filter(doc => {
    const fieldValue = getNestedField(doc._source, field);
    return fieldValue !== undefined && fieldValue !== null;
  });
}

/**
 * Get nested field value from object (supports dot notation like "user.name")
 */
function getNestedField(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Parse minimum_should_match value
 * Supports: number, percentage string ("50%"), or expressions ("2<50%")
 */
function parseMinimumShouldMatch(value: any, totalShould: number): number {
  if (typeof value === 'number') {
    return Math.min(value, totalShould);
  }

  if (typeof value === 'string') {
    if (value.endsWith('%')) {
      const percentage = parseFloat(value);
      if (!isNaN(percentage)) {
        return Math.ceil((percentage / 100) * totalShould);
      }
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return Math.min(num, totalShould);
      }
    }
  }

  return 1; // Default: at least one should match
}
