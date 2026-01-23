import { DiagramState, CanvasNode, CanvasConnection } from '@/types';
import { logInfo, logWarn, logError } from './logger';

/**
 * Protocol node types that should be migrated to connection protocols
 */
const PROTOCOL_NODE_TYPES = ['rest', 'grpc', 'graphql', 'soap', 'websocket', 'webhook'] as const;
type ProtocolNodeType = typeof PROTOCOL_NODE_TYPES[number];

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migratedNodes: number;
  migratedConnections: number;
  errors: string[];
}

/**
 * Migrate protocol nodes to connection protocols
 * 
 * This migration:
 * 1. Finds all protocol nodes (rest, grpc, graphql, soap, websocket, webhook)
 * 2. For each protocol node:
 *    - Finds all incoming connections (source → protocol node)
 *    - Finds all outgoing connections (protocol node → target)
 *    - Creates new direct connections (source → target) with protocol from node type
 *    - Removes old connections through protocol node
 *    - Removes the protocol node itself
 * 
 * Example:
 * BEFORE: CRM → REST API → Payment Gateway
 * AFTER:  CRM → Payment Gateway (with protocol: 'rest' on connection)
 */
export function migrateProtocolsToConnections(
  state: DiagramState
): { state: DiagramState; result: MigrationResult } {
  const result: MigrationResult = {
    success: true,
    migratedNodes: 0,
    migratedConnections: 0,
    errors: [],
  };

  try {
    const { nodes, connections } = state;
    
    // Find all protocol nodes
    const protocolNodes = nodes.filter((node) =>
      PROTOCOL_NODE_TYPES.includes(node.type as ProtocolNodeType)
    );

    if (protocolNodes.length === 0) {
      logInfo('No protocol nodes found, migration not needed');
      return { state, result };
    }

    logInfo(`Found ${protocolNodes.length} protocol nodes to migrate`);

    // Create maps for efficient lookup
    const nodeMap = new Map<string, CanvasNode>(nodes.map((n) => [n.id, n]));
    const connectionMap = new Map<string, CanvasConnection>(
      connections.map((c) => [c.id, c])
    );

    // Track nodes and connections to remove
    const nodesToRemove = new Set<string>();
    const connectionsToRemove = new Set<string>();
    const connectionsToAdd: CanvasConnection[] = [];

    // Process each protocol node
    for (const protocolNode of protocolNodes) {
      const protocolType = protocolNode.type as ProtocolNodeType;

      try {
        // Find all connections where this protocol node is the target (incoming)
        const incomingConnections = connections.filter(
          (conn) => conn.target === protocolNode.id
        );

        // Find all connections where this protocol node is the source (outgoing)
        const outgoingConnections = connections.filter(
          (conn) => conn.source === protocolNode.id
        );

        // Process incoming + outgoing pairs
        // For each incoming connection, create a direct connection to each outgoing target
        for (const incoming of incomingConnections) {
          const sourceNode = nodeMap.get(incoming.source);
          if (!sourceNode) {
            result.errors.push(
              `Source node ${incoming.source} not found for connection ${incoming.id}`
            );
            continue;
          }

          // If there are outgoing connections, create direct connections
          if (outgoingConnections.length > 0) {
            for (const outgoing of outgoingConnections) {
              const targetNode = nodeMap.get(outgoing.target);
              if (!targetNode) {
                result.errors.push(
                  `Target node ${outgoing.target} not found for connection ${outgoing.id}`
                );
                continue;
              }

              // Skip if source and target are the same
              if (sourceNode.id === targetNode.id) {
                continue;
              }

              // Check if direct connection already exists
              const existingConnection = connections.find(
                (c) => c.source === sourceNode.id && c.target === targetNode.id
              );

              if (existingConnection) {
                // Update existing connection with protocol
                const updatedConnection: CanvasConnection = {
                  ...existingConnection,
                  type: protocolType,
                  data: {
                    ...existingConnection.data,
                    protocol: protocolType,
                    // Merge protocol configs if available
                    protocolConfig: {
                      ...existingConnection.data?.protocolConfig,
                      // Preserve any protocol-specific config from protocol node
                      ...(protocolNode.data?.config && {
                        ...protocolNode.data.config,
                      }),
                    },
                  },
                };
                connectionsToAdd.push(updatedConnection);
                connectionsToRemove.add(existingConnection.id);
              } else {
                // Create new direct connection with protocol
                const newConnection: CanvasConnection = {
                  id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  source: sourceNode.id,
                  target: targetNode.id,
                  type: protocolType,
                  label: `${sourceNode.data.label} → ${targetNode.data.label} (${protocolType})`,
                  data: {
                    protocol: protocolType,
                    // Copy network parameters from incoming connection if available
                    latencyMs: incoming.data?.latencyMs,
                    bandwidthMbps: incoming.data?.bandwidthMbps,
                    packetLossPercent: incoming.data?.packetLossPercent,
                    jitterMs: incoming.data?.jitterMs,
                    priorityLevel: incoming.data?.priorityLevel,
                    retryCount: incoming.data?.retryCount,
                    timeoutMs: incoming.data?.timeoutMs,
                    enableMonitoring: incoming.data?.enableMonitoring,
                    // Add protocol-specific config from protocol node
                    protocolConfig: protocolNode.data?.config
                      ? { ...protocolNode.data.config }
                      : undefined,
                  },
                  sourcePort: incoming.sourcePort,
                  targetPort: outgoing.targetPort,
                };
                connectionsToAdd.push(newConnection);
              }

              // Mark connections for removal
              connectionsToRemove.add(incoming.id);
              connectionsToRemove.add(outgoing.id);
            }
          } else {
            // No outgoing connections - protocol node is a dead end
            // Just remove incoming connection and protocol node
            connectionsToRemove.add(incoming.id);
            result.errors.push(
              `Protocol node ${protocolNode.id} has no outgoing connections`
            );
          }
        }

        // If protocol node has outgoing but no incoming connections
        // (shouldn't happen in normal flow, but handle it)
        if (incomingConnections.length === 0 && outgoingConnections.length > 0) {
          result.errors.push(
            `Protocol node ${protocolNode.id} has outgoing but no incoming connections`
          );
          // Remove outgoing connections
          outgoingConnections.forEach((conn) => connectionsToRemove.add(conn.id));
        }

        // Mark protocol node for removal
        nodesToRemove.add(protocolNode.id);
        result.migratedNodes++;
      } catch (error) {
        const errorMsg = `Error migrating protocol node ${protocolNode.id}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        result.errors.push(errorMsg);
        logError(errorMsg, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Build new state
    const newNodes = nodes.filter((node) => !nodesToRemove.has(node.id));
    const newConnections = [
      // Keep connections that are not being removed
      ...connections.filter((conn) => !connectionsToRemove.has(conn.id)),
      // Add new/updated connections
      ...connectionsToAdd,
    ];

    // Remove duplicates (in case we updated existing connections)
    const uniqueConnections = Array.from(
      new Map(newConnections.map((conn) => [conn.id, conn])).values()
    );

    result.migratedConnections = connectionsToAdd.length;

    logInfo(
      `Migration complete: removed ${result.migratedNodes} protocol nodes, ` +
        `created/updated ${result.migratedConnections} connections`
    );

    if (result.errors.length > 0) {
      logWarn(`Migration completed with ${result.errors.length} errors`);
    }

    return {
      state: {
        ...state,
        nodes: newNodes,
        connections: uniqueConnections,
      },
      result,
    };
  } catch (error) {
    result.success = false;
    const errorMsg = `Migration failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
    result.errors.push(errorMsg);
    logError(errorMsg, error instanceof Error ? error : new Error(String(error)));
    return { state, result };
  }
}

/**
 * Check if migration is needed
 */
export function needsProtocolMigration(state: DiagramState): boolean {
  return state.nodes.some((node) =>
    PROTOCOL_NODE_TYPES.includes(node.type as ProtocolNodeType)
  );
}
