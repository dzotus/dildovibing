/**
 * Google Cloud Pub/Sub Constants
 * Default values and configuration constants for GCP Pub/Sub component
 */

/**
 * Default project ID placeholder - should be configured by user
 * Empty string means project ID must be configured
 */
export const DEFAULT_GCP_PROJECT_ID = '';

/**
 * Default values for GCP Pub/Sub topics
 */
export const DEFAULT_TOPIC_VALUES = {
  messageRetentionDuration: 604800, // 7 days in seconds
};

/**
 * Default values for GCP Pub/Sub subscriptions
 */
export const DEFAULT_SUBSCRIPTION_VALUES = {
  ackDeadlineSeconds: 10, // seconds
  enableMessageOrdering: false,
  messageRetentionDuration: undefined, // Uses topic's retention by default
};

/**
 * Google Cloud Pub/Sub naming rules
 * Project ID: 6-30 characters, lowercase letters, numbers, hyphens
 * Topic/Subscription name: 3-255 characters, lowercase letters, numbers, hyphens, underscores
 */
export const NAMING_RULES = {
  PROJECT_ID: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 30,
    PATTERN: /^[a-z0-9-]+$/, // lowercase letters, numbers, hyphens only
  },
  TOPIC_SUBSCRIPTION: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 255,
    PATTERN: /^[a-z0-9-_]+$/, // lowercase letters, numbers, hyphens, underscores
  },
};

/**
 * Validation ranges for numeric fields
 */
export const VALIDATION_RANGES = {
  ACK_DEADLINE_SECONDS: {
    MIN: 10,
    MAX: 600,
  },
  MESSAGE_RETENTION_DURATION: {
    MIN: 600, // 10 minutes
    MAX: 2678400, // 31 days
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