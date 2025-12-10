import { ComponentMetrics } from '@/core/EmulationEngine';
import { ComponentState } from '@/core/ComponentStateEngine';
import { ComponentStatus } from '@/core/DependencyGraphEngine';

/**
 * Runtime status of a component for UI display
 */
export type ComponentRuntimeStatus = 'running' | 'stopped' | 'degraded' | 'error' | 'idle';

/**
 * Options for determining component runtime status
 */
export interface ComponentStatusOptions {
  isSimulationRunning: boolean;
  componentState?: ComponentState;
  metrics?: ComponentMetrics;
  dependencyStatus?: ComponentStatus;
  hasConnections?: boolean;
  customCheck?: (options: ComponentStatusOptions) => ComponentRuntimeStatus | null;
}

/**
 * Determine component runtime status based on simulation state, metrics, and dependencies
 * This is a reusable utility that can be used across different components
 */
export function getComponentRuntimeStatus(options: ComponentStatusOptions): ComponentRuntimeStatus {
  const {
    isSimulationRunning,
    componentState,
    metrics,
    dependencyStatus,
    hasConnections = false,
    customCheck,
  } = options;

  // Allow custom check to override default logic
  if (customCheck) {
    const customStatus = customCheck(options);
    if (customStatus !== null) {
      return customStatus;
    }
  }

  // If simulation is not running, component is stopped
  if (!isSimulationRunning) {
    return 'stopped';
  }

  // Check manual component state (enabled/disabled/degraded/failed)
  if (componentState === 'disabled' || componentState === 'failed') {
    return componentState === 'failed' ? 'error' : 'stopped';
  }

  if (componentState === 'degraded') {
    return 'degraded';
  }

  // Check dependency health status
  if (dependencyStatus) {
    if (dependencyStatus.health === 'down' || dependencyStatus.health === 'critical') {
      return 'error';
    }
    if (dependencyStatus.health === 'degraded') {
      return 'degraded';
    }
  }

  // If no connections and no metrics, component is idle
  if (!hasConnections && (!metrics || (metrics.throughput === 0 && metrics.errorRate === 0))) {
    return 'idle';
  }

  // Check metrics for error state
  if (metrics) {
    // High error rate indicates error state
    if (metrics.errorRate > 0.5) {
      return 'error';
    }

    // Moderate error rate or high latency indicates degraded state
    if (metrics.errorRate > 0.1 || (metrics.latency && metrics.latency > 1000)) {
      return 'degraded';
    }

    // Component is running if it has activity
    if (metrics.throughput > 0 || metrics.utilization > 0 || metrics.errorRate > 0) {
      return 'running';
    }
  }

  // Default: component is running but idle
  return hasConnections ? 'running' : 'idle';
}

/**
 * Get status badge variant for UI components
 */
export function getStatusBadgeVariant(status: ComponentRuntimeStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':
      return 'default';
    case 'stopped':
      return 'outline';
    case 'degraded':
      return 'secondary';
    case 'error':
      return 'destructive';
    case 'idle':
      return 'outline';
    default:
      return 'outline';
  }
}

/**
 * Get status color class for UI components
 */
export function getStatusColorClass(status: ComponentRuntimeStatus): string {
  switch (status) {
    case 'running':
      return 'text-green-600 dark:text-green-400';
    case 'stopped':
      return 'text-gray-500 dark:text-gray-400';
    case 'degraded':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'idle':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
}

/**
 * Get status background color class for UI components
 */
export function getStatusBgColorClass(status: ComponentRuntimeStatus): string {
  switch (status) {
    case 'running':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'stopped':
      return 'bg-gray-100 dark:bg-gray-900/30';
    case 'degraded':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'error':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'idle':
      return 'bg-blue-100 dark:bg-blue-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30';
  }
}

/**
 * Get status indicator dot color
 */
export function getStatusDotColor(status: ComponentRuntimeStatus): string {
  switch (status) {
    case 'running':
      return 'bg-green-500';
    case 'stopped':
      return 'bg-gray-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'idle':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

