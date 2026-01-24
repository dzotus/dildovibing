/**
 * Cassandra Validation Utilities
 * 
 * Функции валидации для компонента Apache Cassandra.
 * Обеспечивают проверку всех параметров конфигурации перед использованием.
 */

import { ConsistencyLevel } from '@/core/CassandraRoutingEngine';

// ============================================================================
// Address Validation
// ============================================================================

export interface AddressValidationResult {
  valid: boolean;
  error?: string;
  host?: string;
  port?: number;
}

/**
 * Validates Cassandra node address format (host:port)
 */
export function validateNodeAddress(address: string): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return {
      valid: false,
      error: 'Address is required and must be a string',
    };
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Address cannot be empty',
    };
  }

  // Check format: host:port
  const parts = trimmed.split(':');
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Address must be in format "host:port"',
    };
  }

  const [host, portStr] = parts;
  const trimmedHost = host.trim();
  const trimmedPort = portStr.trim();

  // Validate host
  if (!trimmedHost) {
    return {
      valid: false,
      error: 'Host cannot be empty',
    };
  }

  // Validate host format (hostname or IP)
  if (!isValidHost(trimmedHost)) {
    return {
      valid: false,
      error: 'Host must be a valid hostname or IP address',
    };
  }

  // Validate port
  const port = parseInt(trimmedPort, 10);
  if (isNaN(port)) {
    return {
      valid: false,
      error: 'Port must be a number',
    };
  }

  if (port < 1 || port > 65535) {
    return {
      valid: false,
      error: 'Port must be between 1 and 65535',
    };
  }

  return {
    valid: true,
    host: trimmedHost,
    port,
  };
}

/**
 * Checks if a string is a valid hostname or IP address
 */
function isValidHost(host: string): boolean {
  // Check for valid hostname (alphanumeric, dots, hyphens, underscores)
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]{0,61}[a-zA-Z0-9])?$/;
  
  // Check for valid IP address (IPv4)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // Check for localhost
  if (host === 'localhost') {
    return true;
  }

  // Check for valid hostname
  if (hostnameRegex.test(host)) {
    return true;
  }

  // Check for valid IPv4
  if (ipv4Regex.test(host)) {
    const parts = host.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return false;
}

/**
 * Checks if an address is unique among existing addresses
 */
export function isAddressUnique(address: string, existingAddresses: string[]): boolean {
  if (!address) return false;
  
  const normalized = address.trim().toLowerCase();
  return !existingAddresses.some(existing => existing.trim().toLowerCase() === normalized);
}

// ============================================================================
// Replication Factor Validation
// ============================================================================

export interface ReplicationFactorValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates replication factor
 */
export function validateReplicationFactor(
  replicationFactor: number,
  nodeCount: number
): ReplicationFactorValidationResult {
  if (typeof replicationFactor !== 'number' || isNaN(replicationFactor)) {
    return {
      valid: false,
      error: 'Replication factor must be a number',
    };
  }

  if (replicationFactor < 1) {
    return {
      valid: false,
      error: 'Replication factor must be at least 1',
    };
  }

  if (replicationFactor > nodeCount) {
    return {
      valid: false,
      error: `Replication factor (${replicationFactor}) cannot exceed number of nodes (${nodeCount})`,
    };
  }

  if (!Number.isInteger(replicationFactor)) {
    return {
      valid: false,
      error: 'Replication factor must be an integer',
    };
  }

  return {
    valid: true,
  };
}

// ============================================================================
// Consistency Level Validation
// ============================================================================

export interface ConsistencyLevelValidationResult {
  valid: boolean;
  error?: string;
}

const VALID_CONSISTENCY_LEVELS: ConsistencyLevel[] = [
  'ONE',
  'TWO',
  'THREE',
  'QUORUM',
  'ALL',
  'LOCAL_ONE',
  'LOCAL_QUORUM',
  'EACH_QUORUM',
  'SERIAL',
  'LOCAL_SERIAL',
];

/**
 * Validates consistency level
 */
export function validateConsistencyLevel(
  consistencyLevel: string
): ConsistencyLevelValidationResult {
  if (!consistencyLevel || typeof consistencyLevel !== 'string') {
    return {
      valid: false,
      error: 'Consistency level is required',
    };
  }

  const upper = consistencyLevel.toUpperCase();
  if (!VALID_CONSISTENCY_LEVELS.includes(upper as ConsistencyLevel)) {
    return {
      valid: false,
      error: `Invalid consistency level. Must be one of: ${VALID_CONSISTENCY_LEVELS.join(', ')}`,
    };
  }

  return {
    valid: true,
  };
}

// ============================================================================
// Keyspace/Table Name Validation
// ============================================================================

export interface NameValidationResult {
  valid: boolean;
  error?: string;
}

// CQL reserved words (partial list - most common)
const CQL_RESERVED_WORDS = new Set([
  'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop',
  'alter', 'use', 'keyspace', 'table', 'index', 'materialized', 'view',
  'primary', 'key', 'with', 'and', 'or', 'not', 'in', 'like', 'order', 'by',
  'limit', 'allow', 'filtering', 'if', 'exists', 'set', 'add', 'rename',
  'to', 'type', 'ascii', 'bigint', 'blob', 'boolean', 'counter', 'date',
  'decimal', 'double', 'float', 'frozen', 'inet', 'int', 'list', 'map',
  'smallint', 'text', 'time', 'timestamp', 'timeuuid', 'tinyint', 'tuple',
  'uuid', 'varchar', 'varint', 'writetime', 'ttl',
]);

/**
 * Validates keyspace or table name according to CQL naming rules
 */
export function validateKeyspaceOrTableName(name: string): NameValidationResult {
  if (!name || typeof name !== 'string') {
    return {
      valid: false,
      error: 'Name is required and must be a string',
    };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Name cannot be empty',
    };
  }

  // CQL names can contain alphanumeric characters and underscores
  // Must start with a letter or underscore
  // Cannot be a reserved word (case-insensitive)
  const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  if (!nameRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must start with a letter or underscore and contain only alphanumeric characters and underscores',
    };
  }

  // Check for reserved words (case-insensitive)
  if (CQL_RESERVED_WORDS.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: `"${trimmed}" is a reserved word and cannot be used as a name`,
    };
  }

  // Check length (Cassandra has limits, typically 48 characters for keyspace, 48 for table)
  if (trimmed.length > 48) {
    return {
      valid: false,
      error: 'Name cannot exceed 48 characters',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Checks if a keyspace or table name is unique (case-insensitive)
 */
export function isNameUnique(name: string, existingNames: string[]): boolean {
  if (!name) return false;
  
  const normalized = name.trim().toLowerCase();
  return !existingNames.some(existing => existing.trim().toLowerCase() === normalized);
}

// ============================================================================
// Node Tokens Validation
// ============================================================================

export interface TokensValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates node tokens configuration
 */
export function validateNodeTokens(tokens: number): TokensValidationResult {
  if (typeof tokens !== 'number' || isNaN(tokens)) {
    return {
      valid: false,
      error: 'Tokens must be a number',
    };
  }

  if (tokens < 1) {
    return {
      valid: false,
      error: 'Tokens must be at least 1',
    };
  }

  if (!Number.isInteger(tokens)) {
    return {
      valid: false,
      error: 'Tokens must be an integer',
    };
  }

  // Typical range for vnodes is 1-256, but allow higher for manual token assignment
  if (tokens > 10000) {
    return {
      valid: false,
      error: 'Tokens cannot exceed 10000',
    };
  }

  return {
    valid: true,
  };
}

// ============================================================================
// Node Load Validation
// ============================================================================

export interface LoadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates node load (0.0 to 1.0)
 */
export function validateNodeLoad(load: number): LoadValidationResult {
  if (typeof load !== 'number' || isNaN(load)) {
    return {
      valid: false,
      error: 'Load must be a number',
    };
  }

  if (load < 0 || load > 1) {
    return {
      valid: false,
      error: 'Load must be between 0.0 and 1.0',
    };
  }

  return {
    valid: true,
  };
}

// ============================================================================
// Combined Validation
// ============================================================================

export interface NodeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a complete node configuration
 */
export function validateNode(
  node: {
    address: string;
    tokens?: number;
    load?: number;
    datacenter?: string;
    rack?: string;
  },
  existingAddresses: string[] = []
): NodeValidationResult {
  const errors: string[] = [];

  // Validate address
  const addressResult = validateNodeAddress(node.address);
  if (!addressResult.valid) {
    errors.push(`Address: ${addressResult.error}`);
  } else if (!isAddressUnique(node.address, existingAddresses)) {
    errors.push(`Address: "${node.address}" is already in use`);
  }

  // Validate tokens if provided
  if (node.tokens !== undefined) {
    const tokensResult = validateNodeTokens(node.tokens);
    if (!tokensResult.valid) {
      errors.push(`Tokens: ${tokensResult.error}`);
    }
  }

  // Validate load if provided
  if (node.load !== undefined) {
    const loadResult = validateNodeLoad(node.load);
    if (!loadResult.valid) {
      errors.push(`Load: ${loadResult.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
