/**
 * Kong Gateway Constants
 * Default values and configuration constants for Kong Gateway component
 */

/**
 * Default Kong Gateway configuration values
 */
export const DEFAULT_KONG_VALUES = {
  ADMIN_URL: 'http://kong:8001',
  SERVICE_NAME: 'core-service',
  UPSTREAM_URL: 'http://core:8080',
  ROUTE_PATHS: ['/api', '/v1'],
  AUTH_PLUGIN: 'key-auth',
  RATE_LIMIT_PER_MINUTE: 1000,
  LOGGING_TARGET: 'loki',
  REQUESTS_PER_SECOND: 450,
};

/**
 * Default values for Kong Services
 */
export const DEFAULT_SERVICE_VALUES = {
  name: 'new-service',
  url: 'http://service:8080',
  enabled: true,
};

/**
 * Default values for Kong Routes
 */
export const DEFAULT_ROUTE_VALUES = {
  path: '/new-path',
  method: 'GET',
  stripPath: true,
  priority: 0,
  protocols: ['http', 'https'] as string[],
};

/**
 * Default values for Kong Upstreams
 */
export const DEFAULT_UPSTREAM_VALUES = {
  name: 'new-upstream',
  algorithm: 'round-robin' as const,
  healthchecks: {
    active: true,
    passive: true,
  },
  targets: [
    {
      target: 'server:8080',
      weight: 100,
      health: 'healthy' as const,
    },
  ],
};

/**
 * Default values for Kong Consumers
 */
export const DEFAULT_CONSUMER_VALUES = {
  username: 'new-consumer',
  credentials: [],
};

/**
 * Default values for Kong Plugins
 */
export const DEFAULT_PLUGIN_VALUES = {
  name: 'rate-limiting',
  enabled: true,
  config: {},
};

/**
 * Default plugins configuration
 * These are only used if no plugins are configured in the component
 */
export const DEFAULT_PLUGINS = [
  {
    id: '1',
    name: 'rate-limiting',
    enabled: true,
    config: { minute: 1000, hour: 10000 },
  },
  {
    id: '2',
    name: 'key-auth',
    enabled: true,
    config: { key_names: ['apikey'] },
  },
  {
    id: '3',
    name: 'cors',
    enabled: true,
    config: {
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  },
];

/**
 * Kong Gateway naming rules
 * Service/Route/Upstream/Consumer name: alphanumeric, hyphens, underscores
 */
export const NAMING_RULES = {
  SERVICE_ROUTE_UPSTREAM_CONSUMER: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
    PATTERN: /^[a-zA-Z0-9_-]+$/, // alphanumeric, hyphens, underscores
  },
  URL: {
    PATTERN: /^https?:\/\/.+/i, // http:// or https:// followed by at least one character
  },
  PATH: {
    PATTERN: /^\/.*/, // must start with /
  },
};

/**
 * Validation ranges for numeric fields
 */
export const VALIDATION_RANGES = {
  WEIGHT: {
    MIN: 1,
    MAX: 1000,
  },
  PRIORITY: {
    MIN: 0,
    MAX: 1000,
  },
  RATE_LIMIT_PER_MINUTE: {
    MIN: 1,
    MAX: 1000000,
  },
  REQUESTS_PER_SECOND: {
    MIN: 1,
    MAX: 100000,
  },
};

/**
 * Metrics update configuration
 */
export const METRICS_UPDATE_CONFIG = {
  /**
   * Interval for syncing metrics from routing engine (milliseconds)
   * Updates metrics every 500ms during simulation
   */
  SYNC_INTERVAL_MS: 500,
  
  /**
   * Debounce delay for updateNode calls (milliseconds)
   * Prevents excessive updates when metrics change frequently
   */
  DEBOUNCE_DELAY_MS: 300,
};
