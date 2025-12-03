import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentMetrics, ConnectionMetrics } from './EmulationEngine';

/**
 * Dependency relationship between components
 */
export interface Dependency {
  sourceId: string;
  targetId: string;
  connectionId: string;
  type: 'direct' | 'indirect' | 'critical';
  strength: number; // 0-1 - how strong the dependency is
  impact: number; // 0-1 - how much target is affected by source issues
}

/**
 * Component health status
 */
export type ComponentHealth = 'healthy' | 'degraded' | 'critical' | 'down';

/**
 * Component status with health and dependencies
 */
export interface ComponentStatus {
  nodeId: string;
  health: ComponentHealth;
  dependencies: Dependency[];
  dependents: Dependency[]; // components that depend on this one
  criticalPath: boolean; // is this component on a critical path?
  impactScore: number; // 0-1 - how much this component affects the system
  failureRisk: number; // 0-1 - risk of failure based on metrics
}

/**
 * System-wide analysis
 */
export interface SystemAnalysis {
  criticalPaths: string[][]; // paths of node IDs that are critical
  bottlenecks: string[]; // node IDs that are bottlenecks
  riskComponents: string[]; // components at risk of failure
  recommendations: Recommendation[];
  overallHealth: ComponentHealth;
}

/**
 * Recommendation for optimization
 */
export interface Recommendation {
  type: 'scaling' | 'optimization' | 'redundancy' | 'monitoring' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  componentId?: string;
  connectionId?: string;
  message: string;
  impact: string;
  suggestion: string;
}

/**
 * Dependency Graph Engine - analyzes component relationships and system health
 */
export class DependencyGraphEngine {
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private dependencyGraph: Map<string, Dependency[]> = new Map(); // nodeId -> dependencies
  private componentStatuses: Map<string, ComponentStatus> = new Map();

  /**
   * Update with current system state
   */
  public update(
    nodes: CanvasNode[],
    connections: CanvasConnection[],
    componentMetrics: Map<string, ComponentMetrics>,
    connectionMetrics: Map<string, ConnectionMetrics>
  ) {
    this.nodes = nodes;
    this.connections = connections;
    this.componentMetrics = componentMetrics;
    this.connectionMetrics = connectionMetrics;
    
    this.buildDependencyGraph();
    this.analyzeComponentHealth();
    this.identifyCriticalPaths();
    this.calculateImpactScores();
  }

  /**
   * Build dependency graph from connections
   */
  private buildDependencyGraph() {
    this.dependencyGraph.clear();
    
    for (const node of this.nodes) {
      const dependencies: Dependency[] = [];
      
      // Find all incoming connections (dependencies)
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      
      for (const conn of incomingConnections) {
        const connMetrics = this.connectionMetrics.get(conn.id);
        const sourceMetrics = this.componentMetrics.get(conn.source);
        
        if (!connMetrics || !sourceMetrics) continue;
        
        // Calculate dependency strength based on:
        // 1. Throughput dependency
        // 2. Connection utilization
        // 3. Backpressure
        const strength = Math.max(
          connMetrics.throughputDependency,
          connMetrics.utilization,
          connMetrics.backpressure
        );
        
        // Determine dependency type
        let type: Dependency['type'] = 'direct';
        if (connMetrics.bottleneck) {
          type = 'critical';
        } else if (strength > 0.7) {
          type = 'indirect';
        }
        
        dependencies.push({
          sourceId: conn.source,
          targetId: node.id,
          connectionId: conn.id,
          type,
          strength,
          impact: this.calculateDependencyImpact(conn, sourceMetrics),
        });
      }
      
      this.dependencyGraph.set(node.id, dependencies);
    }
  }

  /**
   * Calculate how much a dependency affects the target
   */
  private calculateDependencyImpact(
    connection: CanvasConnection,
    sourceMetrics: ComponentMetrics
  ): number {
    const connMetrics = this.connectionMetrics.get(connection.id);
    if (!connMetrics) return 0;
    
    // Impact increases with:
    // 1. Source error rate
    // 2. Connection latency
    // 3. Backpressure
    // 4. Source utilization (if high, less capacity for this connection)
    const errorImpact = sourceMetrics.errorRate;
    const latencyImpact = Math.min(1, connMetrics.latency / 1000); // normalize to 1s
    const backpressureImpact = connMetrics.backpressure;
    const utilizationImpact = sourceMetrics.utilization > 0.8 ? 0.5 : 0;
    
    return Math.min(1, 
      (errorImpact * 0.4) +
      (latencyImpact * 0.2) +
      (backpressureImpact * 0.3) +
      (utilizationImpact * 0.1)
    );
  }

  /**
   * Analyze health of each component
   */
  private analyzeComponentHealth() {
    this.componentStatuses.clear();
    
    for (const node of this.nodes) {
      const metrics = this.componentMetrics.get(node.id);
      const dependencies = this.dependencyGraph.get(node.id) || [];
      
      if (!metrics) {
        this.componentStatuses.set(node.id, {
          nodeId: node.id,
          health: 'down',
          dependencies,
          dependents: [],
          criticalPath: false,
          impactScore: 0,
          failureRisk: 1.0,
        });
        continue;
      }
      
      // Calculate health based on metrics
      let health: ComponentHealth = 'healthy';
      let failureRisk = 0;
      
      // Error rate contributes to health
      if (metrics.errorRate > 0.1) {
        health = 'critical';
        failureRisk += 0.4;
      } else if (metrics.errorRate > 0.05) {
        health = 'degraded';
        failureRisk += 0.2;
      }
      
      // High utilization increases risk
      if (metrics.utilization > 0.9) {
        if (health === 'healthy') health = 'degraded';
        failureRisk += 0.3;
      } else if (metrics.utilization > 0.8) {
        failureRisk += 0.15;
      }
      
      // High latency indicates problems
      if (metrics.latency > 1000) {
        if (health === 'healthy') health = 'degraded';
        failureRisk += 0.2;
      } else if (metrics.latency > 500) {
        failureRisk += 0.1;
      }
      
      // Dependencies affect health (cascade effect)
      for (const dep of dependencies) {
        const depStatus = this.componentStatuses.get(dep.sourceId);
        if (depStatus) {
          if (depStatus.health === 'critical' || depStatus.health === 'down') {
            if (health === 'healthy') health = 'degraded';
            failureRisk += dep.impact * 0.3;
          } else if (depStatus.health === 'degraded') {
            failureRisk += dep.impact * 0.15;
          }
        }
      }
      
      failureRisk = Math.min(1, failureRisk);
      
      // Find dependents (components that depend on this one)
      const dependents: Dependency[] = [];
      for (const conn of this.connections) {
        if (conn.source === node.id) {
          const connMetrics = this.connectionMetrics.get(conn.id);
          if (connMetrics) {
            dependents.push({
              sourceId: node.id,
              targetId: conn.target,
              connectionId: conn.id,
              type: connMetrics.bottleneck ? 'critical' : 'direct',
              strength: connMetrics.throughputDependency,
              impact: this.calculateDependencyImpact(conn, metrics),
            });
          }
        }
      }
      
      this.componentStatuses.set(node.id, {
        nodeId: node.id,
        health,
        dependencies,
        dependents,
        criticalPath: false, // will be set by identifyCriticalPaths
        impactScore: 0, // will be set by calculateImpactScores
        failureRisk,
      });
    }
  }

  /**
   * Identify critical paths in the system
   */
  private identifyCriticalPaths() {
    // Find all source nodes (no incoming connections)
    const sourceNodes = this.nodes.filter(node => {
      return !this.connections.some(conn => conn.target === node.id);
    });
    
    // Find all sink nodes (no outgoing connections)
    const sinkNodes = this.nodes.filter(node => {
      return !this.connections.some(conn => conn.source === node.id);
    });
    
    const criticalPaths: string[][] = [];
    
    // Find paths from sources to sinks
    for (const source of sourceNodes) {
      for (const sink of sinkNodes) {
        const path = this.findPath(source.id, sink.id);
        if (path && path.length > 1) {
          // Check if path is critical (has bottlenecks or high dependencies)
          const isCritical = path.some(nodeId => {
            const status = this.componentStatuses.get(nodeId);
            const conn = this.connections.find(c => 
              path.includes(c.source) && path.includes(c.target) &&
              path.indexOf(c.source) < path.indexOf(c.target)
            );
            if (conn) {
              const connMetrics = this.connectionMetrics.get(conn.id);
              return connMetrics?.bottleneck || (connMetrics?.backpressure || 0) > 0.7;
            }
            return status?.health === 'critical' || status?.health === 'down';
          });
          
          if (isCritical) {
            criticalPaths.push(path);
            // Mark nodes on critical path
            path.forEach(nodeId => {
              const status = this.componentStatuses.get(nodeId);
              if (status) {
                status.criticalPath = true;
              }
            });
          }
        }
      }
    }
  }

  /**
   * Find path from source to target using BFS
   */
  private findPath(sourceId: string, targetId: string): string[] | null {
    if (sourceId === targetId) return [sourceId];
    
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);
    
    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      // Find outgoing connections
      const outgoing = this.connections.filter(c => c.source === nodeId);
      
      for (const conn of outgoing) {
        if (conn.target === targetId) {
          return [...path, targetId];
        }
        
        if (!visited.has(conn.target)) {
          visited.add(conn.target);
          queue.push({ nodeId: conn.target, path: [...path, conn.target] });
        }
      }
    }
    
    return null;
  }

  /**
   * Calculate impact scores for each component
   */
  private calculateImpactScores() {
    // Impact score = how much this component affects the system
    // Based on:
    // 1. Number of dependents
    // 2. Health status
    // 3. Position in critical paths
    // 4. Failure risk
    
    for (const [nodeId, status] of this.componentStatuses.entries()) {
      let impactScore = 0;
      
      // Base impact from dependents count
      impactScore += Math.min(1, status.dependents.length / 5) * 0.3;
      
      // Health impact
      if (status.health === 'critical' || status.health === 'down') {
        impactScore += 0.4;
      } else if (status.health === 'degraded') {
        impactScore += 0.2;
      }
      
      // Critical path impact
      if (status.criticalPath) {
        impactScore += 0.2;
      }
      
      // Failure risk impact
      impactScore += status.failureRisk * 0.1;
      
      status.impactScore = Math.min(1, impactScore);
      this.componentStatuses.set(nodeId, status);
    }
  }

  /**
   * Generate system analysis and recommendations
   */
  public analyzeSystem(): SystemAnalysis {
    const criticalPaths: string[][] = [];
    const bottlenecks: string[] = [];
    const riskComponents: string[] = [];
    const recommendations: Recommendation[] = [];
    
    // Collect critical paths
    for (const [nodeId, status] of this.componentStatuses.entries()) {
      if (status.criticalPath) {
        // Find path containing this node
        const path = this.findPathToSink(nodeId);
        if (path && !criticalPaths.some(p => JSON.stringify(p) === JSON.stringify(path))) {
          criticalPaths.push(path);
        }
      }
    }
    
    // Find bottlenecks
    for (const [connId, metrics] of this.connectionMetrics.entries()) {
      if (metrics.bottleneck) {
        const conn = this.connections.find(c => c.id === connId);
        if (conn) {
          if (!bottlenecks.includes(conn.source)) bottlenecks.push(conn.source);
          if (!bottlenecks.includes(conn.target)) bottlenecks.push(conn.target);
        }
      }
    }
    
    // Find risk components
    for (const [nodeId, status] of this.componentStatuses.entries()) {
      if (status.failureRisk > 0.6 || status.health === 'critical' || status.health === 'down') {
        riskComponents.push(nodeId);
      }
    }
    
    // Generate recommendations
    this.generateRecommendations(recommendations);
    
    // Calculate overall health
    const healthScores = Array.from(this.componentStatuses.values()).map(s => {
      switch (s.health) {
        case 'down': return 0;
        case 'critical': return 0.25;
        case 'degraded': return 0.5;
        case 'healthy': return 1;
      }
    });
    const avgHealth = healthScores.length > 0 
      ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length 
      : 1;
    
    let overallHealth: ComponentHealth = 'healthy';
    if (avgHealth < 0.25) overallHealth = 'down';
    else if (avgHealth < 0.5) overallHealth = 'critical';
    else if (avgHealth < 0.75) overallHealth = 'degraded';
    
    return {
      criticalPaths,
      bottlenecks,
      riskComponents,
      recommendations,
      overallHealth,
    };
  }

  /**
   * Find path from node to sink
   */
  private findPathToSink(nodeId: string): string[] | null {
    const sinkNodes = this.nodes.filter(node => {
      return !this.connections.some(conn => conn.source === node.id);
    });
    
    for (const sink of sinkNodes) {
      const path = this.findPath(nodeId, sink.id);
      if (path) return path;
    }
    
    return null;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(recommendations: Recommendation[]) {
    // Analyze each component and connection
    for (const [nodeId, status] of this.componentStatuses.entries()) {
      const node = this.nodes.find(n => n.id === nodeId);
      const metrics = this.componentMetrics.get(nodeId);
      
      if (!node || !metrics) continue;
      
      // High utilization recommendation
      if (metrics.utilization > 0.85) {
        recommendations.push({
          type: 'scaling',
          priority: metrics.utilization > 0.95 ? 'critical' : 'high',
          componentId: nodeId,
          message: `${node.data.label} is highly utilized (${(metrics.utilization * 100).toFixed(0)}%)`,
          impact: 'May cause performance degradation and increased latency',
          suggestion: `Consider scaling ${node.data.label} horizontally or vertically`,
        });
      }
      
      // High error rate recommendation
      if (metrics.errorRate > 0.05) {
        recommendations.push({
          type: 'monitoring',
          priority: metrics.errorRate > 0.1 ? 'critical' : 'high',
          componentId: nodeId,
          message: `${node.data.label} has high error rate (${(metrics.errorRate * 100).toFixed(1)}%)`,
          impact: 'Affects system reliability and user experience',
          suggestion: `Investigate error logs and implement error handling for ${node.data.label}`,
        });
      }
      
      // High latency recommendation
      if (metrics.latency > 500) {
        recommendations.push({
          type: 'optimization',
          priority: metrics.latency > 1000 ? 'high' : 'medium',
          componentId: nodeId,
          message: `${node.data.label} has high latency (${metrics.latency.toFixed(0)}ms)`,
          impact: 'Affects end-to-end response time',
          suggestion: `Optimize ${node.data.label} performance or add caching`,
        });
      }
      
      // Critical path recommendation
      if (status.criticalPath && status.failureRisk > 0.5) {
        recommendations.push({
          type: 'redundancy',
          priority: 'high',
          componentId: nodeId,
          message: `${node.data.label} is on a critical path and at risk`,
          impact: 'Failure would significantly impact system',
          suggestion: `Add redundancy or failover for ${node.data.label}`,
        });
      }
    }
    
    // Analyze connections
    for (const [connId, metrics] of this.connectionMetrics.entries()) {
      const conn = this.connections.find(c => c.id === connId);
      if (!conn) continue;
      
      const sourceNode = this.nodes.find(n => n.id === conn.source);
      const targetNode = this.nodes.find(n => n.id === conn.target);
      
      // Bottleneck recommendation
      if (metrics.bottleneck) {
        recommendations.push({
          type: 'optimization',
          priority: 'critical',
          connectionId: connId,
          message: `Connection between ${sourceNode?.data.label || 'source'} and ${targetNode?.data.label || 'target'} is a bottleneck`,
          impact: 'Limiting overall system throughput',
          suggestion: `Increase bandwidth or optimize data transfer between these components`,
        });
      }
      
      // High backpressure recommendation
      if (metrics.backpressure > 0.7) {
        recommendations.push({
          type: 'optimization',
          priority: 'high',
          connectionId: connId,
          message: `High backpressure (${(metrics.backpressure * 100).toFixed(0)}%) on connection`,
          impact: 'Target component cannot process data fast enough',
          suggestion: `Scale target component or implement buffering/queuing`,
        });
      }
    }
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Get component status
   */
  public getComponentStatus(nodeId: string): ComponentStatus | undefined {
    return this.componentStatuses.get(nodeId);
  }

  /**
   * Get all component statuses
   */
  public getAllComponentStatuses(): ComponentStatus[] {
    return Array.from(this.componentStatuses.values());
  }

  /**
   * Get dependencies for a component
   */
  public getDependencies(nodeId: string): Dependency[] {
    return this.dependencyGraph.get(nodeId) || [];
  }
}

export const dependencyGraphEngine = new DependencyGraphEngine();

