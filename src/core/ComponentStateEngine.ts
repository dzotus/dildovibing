import { CanvasNode } from '@/types';

/**
 * Component operational state
 */
export type ComponentState = 'enabled' | 'disabled' | 'degraded' | 'failed';

/**
 * Component state configuration
 */
export interface ComponentStateConfig {
  nodeId: string;
  state: ComponentState;
  degradedLevel?: number; // 0-1, how degraded (0 = normal, 1 = almost failed)
  failureRate?: number; // 0-1, artificial failure rate when degraded
  latencyMultiplier?: number; // multiplier for latency when degraded
  throughputMultiplier?: number; // multiplier for throughput when degraded
}

/**
 * Component State Engine - manages manual component state control
 */
export class ComponentStateEngine {
  private componentStates: Map<string, ComponentStateConfig> = new Map();

  /**
   * Set component state
   */
  public setComponentState(nodeId: string, state: ComponentState, options?: {
    degradedLevel?: number;
    failureRate?: number;
    latencyMultiplier?: number;
    throughputMultiplier?: number;
  }) {
    const config: ComponentStateConfig = {
      nodeId,
      state,
      degradedLevel: options?.degradedLevel || 0.5,
      failureRate: options?.failureRate || 0.1,
      latencyMultiplier: options?.latencyMultiplier || 2,
      throughputMultiplier: options?.throughputMultiplier || 0.5,
    };

    this.componentStates.set(nodeId, config);
  }

  /**
   * Get component state
   */
  public getComponentState(nodeId: string): ComponentStateConfig | undefined {
    return this.componentStates.get(nodeId);
  }

  /**
   * Check if component is enabled
   */
  public isEnabled(nodeId: string): boolean {
    const state = this.componentStates.get(nodeId);
    return !state || state.state === 'enabled';
  }

  /**
   * Apply state effects to metrics
   */
  public applyStateEffects(nodeId: string, baseMetrics: {
    throughput: number;
    latency: number;
    errorRate: number;
    utilization: number;
  }): {
    throughput: number;
    latency: number;
    errorRate: number;
    utilization: number;
  } {
    const state = this.componentStates.get(nodeId);
    
    if (!state || state.state === 'enabled') {
      return { ...baseMetrics };
    }

    if (state.state === 'disabled' || state.state === 'failed') {
      return {
        throughput: 0,
        latency: Infinity,
        errorRate: 1,
        utilization: 0,
      };
    }

    if (state.state === 'degraded') {
      const level = state.degradedLevel || 0.5;
      return {
        throughput: baseMetrics.throughput * (state.throughputMultiplier || 0.5) * (1 - level * 0.5),
        latency: baseMetrics.latency * (state.latencyMultiplier || 2) * (1 + level),
        errorRate: Math.min(1, baseMetrics.errorRate + (state.failureRate || 0.1) * level),
        utilization: Math.min(1, baseMetrics.utilization * (1 + level * 0.3)),
      };
    }

    return { ...baseMetrics };
  }

  /**
   * Reset all states
   */
  public reset() {
    this.componentStates.clear();
  }

  /**
   * Reset specific component state
   */
  public resetComponent(nodeId: string) {
    this.componentStates.delete(nodeId);
  }

  /**
   * Get all component states
   */
  public getAllStates(): ComponentStateConfig[] {
    return Array.from(this.componentStates.values());
  }
}

export const componentStateEngine = new ComponentStateEngine();

