/**
 * Azure Service Bus Constants
 * Default values and configuration constants for Azure Service Bus component
 */

/**
 * Default namespace placeholder - should be configured by user
 * Empty string means namespace must be configured
 */
export const DEFAULT_AZURE_SERVICE_BUS_NAMESPACE = '';

/**
 * Default values for Azure Service Bus queues
 */
export const DEFAULT_QUEUE_VALUES = {
  maxSizeInMegabytes: 1024,
  defaultMessageTimeToLive: 2592000, // 30 days in seconds
  lockDuration: 30, // seconds
  maxDeliveryCount: 10,
  enablePartitioning: false,
  enableDeadLetteringOnMessageExpiration: true,
  enableSessions: false,
};

/**
 * Default values for Azure Service Bus topics
 */
export const DEFAULT_TOPIC_VALUES = {
  maxSizeInMegabytes: 1024,
  defaultMessageTimeToLive: 2592000, // 30 days in seconds
  enablePartitioning: false,
};

/**
 * Default values for Azure Service Bus subscriptions
 */
export const DEFAULT_SUBSCRIPTION_VALUES = {
  maxDeliveryCount: 10,
  lockDuration: 30, // seconds
  enableDeadLetteringOnMessageExpiration: true,
};

/**
 * Azure Service Bus naming rules
 */
export const NAMING_RULES = {
  MAX_NAME_LENGTH: 260,
  MIN_NAME_LENGTH: 1,
  // Azure Service Bus names can contain letters, numbers, periods (.), hyphens (-), and underscores (_)
  NAME_PATTERN: /^[a-zA-Z0-9._-]+$/,
};
