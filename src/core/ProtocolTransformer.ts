import { DataMessage } from '@/types';
import { CanvasConnection } from '@/types';

/**
 * Protocol Transformer - transforms messages based on connection protocol
 * Protocols are now attributes of connections, not separate nodes
 */
export class ProtocolTransformer {
  /**
   * Transform message for protocol
   */
  transformForProtocol(
    message: DataMessage,
    connection: CanvasConnection
  ): DataMessage {
    const protocol = this.getProtocol(connection);
    if (!protocol) {
      return message;
    }

    const protocolConfig = connection.data?.protocolConfig || {};

    switch (protocol) {
      case 'rest':
        return this.transformForREST(message, protocolConfig);
      case 'graphql':
        return this.transformForGraphQL(message, protocolConfig);
      case 'soap':
        return this.transformForSOAP(message, protocolConfig);
      case 'grpc':
        return this.transformForGRPC(message, protocolConfig);
      case 'websocket':
        return this.transformForWebSocket(message, protocolConfig);
      case 'webhook':
        return this.transformForWebhook(message, protocolConfig);
      default:
        return message;
    }
  }

  /**
   * Get protocol from connection
   */
  private getProtocol(connection: CanvasConnection): string | null {
    // Priority: connection.type > connection.data.protocol > 'http' as default
    if (connection.type && ['rest', 'graphql', 'soap', 'grpc', 'websocket', 'webhook'].includes(connection.type)) {
      return connection.type;
    }
    if (connection.data?.protocol) {
      return connection.data.protocol as string;
    }
    // 'http' is synonym for 'rest'
    if (connection.type === 'http') {
      return 'rest';
    }
    return null;
  }

  /**
   * Transform for REST protocol
   */
  private transformForREST(message: DataMessage, config: any): DataMessage {
    // REST uses JSON format
    if (message.format !== 'json') {
      message.format = 'json';
      message.status = 'transformed';
    }

    // Convert payload to JSON string if needed
    if (typeof message.payload !== 'string') {
      try {
        message.payload = JSON.stringify(message.payload);
      } catch (e) {
        // If stringify fails, keep original payload
      }
    }

    // Add HTTP headers
    const httpMethod = config.httpMethod || 'POST';
    const contentType = config.contentType || 'json';
    const headers = config.headers || {};

    message.metadata = {
      ...message.metadata,
      'Content-Type': contentType === 'json' ? 'application/json' : 
                     contentType === 'xml' ? 'application/xml' : 
                     'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'X-HTTP-Method': httpMethod,
      ...headers,
    };

    return message;
  }

  /**
   * Transform for GraphQL protocol
   */
  private transformForGraphQL(message: DataMessage, config: any): DataMessage {
    // GraphQL uses JSON format
    if (message.format !== 'json') {
      message.format = 'json';
      message.status = 'transformed';
    }

    // Structure GraphQL request
    const query = config.query || '';
    const operationName = config.operationName;
    const variables = config.variables || {};

    const graphQLPayload = {
      query,
      ...(operationName && { operationName }),
      ...(Object.keys(variables).length > 0 && { variables }),
    };

    message.payload = JSON.stringify(graphQLPayload);
    message.metadata = {
      ...message.metadata,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    return message;
  }

  /**
   * Transform for SOAP protocol
   */
  private transformForSOAP(message: DataMessage, config: any): DataMessage {
    // SOAP uses XML format
    if (message.format !== 'xml') {
      message.format = 'xml';
      message.status = 'transformed';
    }

    const soapAction = config.soapAction || '';
    const namespace = config.namespace || 'http://schemas.xmlsoap.org/soap/envelope/';

    // Add SOAP headers
    message.metadata = {
      ...message.metadata,
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': soapAction,
      'X-SOAP-Namespace': namespace,
    };

    return message;
  }

  /**
   * Transform for gRPC protocol
   */
  private transformForGRPC(message: DataMessage, config: any): DataMessage {
    // gRPC uses binary format
    if (message.format !== 'binary') {
      message.format = 'binary';
      message.status = 'transformed';
    }

    const serviceName = config.serviceName || '';
    const methodName = config.methodName || '';
    const metadata = config.metadata || {};

    message.metadata = {
      ...message.metadata,
      'grpc-service': serviceName,
      'grpc-method': methodName,
      ...metadata,
    };

    return message;
  }

  /**
   * Transform for WebSocket protocol
   */
  private transformForWebSocket(message: DataMessage, config: any): DataMessage {
    // WebSocket can use text or binary
    const binaryType = config.binaryType || 'blob';
    const wsProtocol = config.wsProtocol;
    const subprotocols = config.subprotocols || [];

    if (binaryType === 'arraybuffer' && message.format !== 'binary') {
      message.format = 'binary';
      message.status = 'transformed';
    } else if (message.format !== 'text' && message.format !== 'binary') {
      message.format = 'text';
      message.status = 'transformed';
    }

    message.metadata = {
      ...message.metadata,
      ...(wsProtocol && { 'Sec-WebSocket-Protocol': wsProtocol }),
      ...(subprotocols.length > 0 && { 'X-WebSocket-Subprotocols': subprotocols.join(',') }),
    };

    return message;
  }

  /**
   * Transform for Webhook protocol
   */
  private transformForWebhook(message: DataMessage, config: any): DataMessage {
    // Webhook uses JSON format
    if (message.format !== 'json') {
      message.format = 'json';
      message.status = 'transformed';
    }

    const webhookEvent = config.webhookEvent || '';
    const signatureHeader = config.signatureHeader || 'X-Signature';

    message.metadata = {
      ...message.metadata,
      'Content-Type': 'application/json',
      'X-Webhook-Event': webhookEvent,
      'X-Signature-Header': signatureHeader,
    };

    return message;
  }

  /**
   * Get supported formats for protocol
   */
  getSupportedFormats(protocol: string): string[] {
    switch (protocol) {
      case 'rest':
        return ['json', 'xml'];
      case 'graphql':
        return ['json'];
      case 'soap':
        return ['xml'];
      case 'grpc':
        return ['binary'];
      case 'websocket':
        return ['text', 'binary'];
      case 'webhook':
        return ['json'];
      default:
        return ['json', 'xml', 'text', 'binary'];
    }
  }

  /**
   * Calculate protocol-specific latency multiplier
   */
  calculateProtocolLatencyMultiplier(protocol: string): number {
    const multipliers: Record<string, number> = {
      'rest': 1.0,
      'graphql': 1.1,  // Slightly slower due to query parsing
      'soap': 1.3,     // Slower due to XML parsing
      'grpc': 0.7,     // Faster due to binary protocol
      'websocket': 0.9, // Faster for real-time
      'webhook': 1.0,
    };

    return multipliers[protocol] || 1.0;
  }
}
