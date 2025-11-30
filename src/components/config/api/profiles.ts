import { ComponentProfile } from '@/components/config/shared/types';

export const API_PROFILES: Record<string, ComponentProfile> = {
  rest: {
    id: 'rest',
    title: 'REST API',
    description: 'Configure REST API endpoints, methods, authentication, and rate limiting',
    defaults: {
      baseUrl: '/api',
      port: 8080,
      protocol: 'http',
      enableCORS: true,
      enableAuthentication: false,
      authType: 'bearer',
      enableRateLimiting: false,
      rateLimitPerMinute: 100,
      endpoints: ['/users', '/products'],
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: '/api' },
          { id: 'port', label: 'Port', type: 'number', placeholder: '8080' },
          {
            id: 'protocol',
            label: 'Protocol',
            type: 'select',
            options: [
              { value: 'http', label: 'HTTP' },
              { value: 'https', label: 'HTTPS' },
            ],
          },
        ],
      },
      {
        id: 'endpoints',
        title: 'Endpoints',
        fields: [
          {
            id: 'endpoints',
            label: 'API Endpoints',
            type: 'list',
            placeholder: '/users',
            defaultListItem: '/users',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableCORS', label: 'Enable CORS', type: 'toggle' },
          { id: 'enableAuthentication', label: 'Enable Authentication', type: 'toggle' },
          {
            id: 'authType',
            label: 'Authentication Type',
            type: 'select',
            options: [
              { value: 'bearer', label: 'Bearer Token' },
              { value: 'basic', label: 'Basic Auth' },
              { value: 'api-key', label: 'API Key' },
              { value: 'oauth2', label: 'OAuth 2.0' },
            ],
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting',
        fields: [
          { id: 'enableRateLimiting', label: 'Enable Rate Limiting', type: 'toggle' },
          { id: 'rateLimitPerMinute', label: 'Requests Per Minute', type: 'number', placeholder: '100' },
        ],
      },
    ],
  },
  grpc: {
    id: 'grpc',
    title: 'gRPC Service',
    description: 'Configure gRPC service, proto definitions, and streaming options',
    defaults: {
      port: 50051,
      enableReflection: true,
      enableTLS: false,
      maxMessageSize: 4194304,
      enableCompression: true,
      compressionType: 'gzip',
      enableKeepAlive: true,
      keepAliveTime: 30,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'port', label: 'Port', type: 'number', placeholder: '50051' },
          { id: 'enableTLS', label: 'Enable TLS', type: 'toggle' },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'maxMessageSize', label: 'Max Message Size (bytes)', type: 'number', placeholder: '4194304' },
          { id: 'enableCompression', label: 'Enable Compression', type: 'toggle' },
          {
            id: 'compressionType',
            label: 'Compression Type',
            type: 'select',
            options: [
              { value: 'gzip', label: 'Gzip' },
              { value: 'deflate', label: 'Deflate' },
            ],
          },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enableReflection', label: 'Enable Reflection', type: 'toggle' },
          { id: 'enableKeepAlive', label: 'Enable Keep-Alive', type: 'toggle' },
          { id: 'keepAliveTime', label: 'Keep-Alive Time (seconds)', type: 'number', placeholder: '30' },
        ],
      },
    ],
  },
  graphql: {
    id: 'graphql',
    title: 'GraphQL API',
    description: 'Configure GraphQL schema, queries, mutations, subscriptions, and resolvers',
    defaults: {
      endpoint: '/graphql',
      port: 4000,
      enablePlayground: true,
      enableIntrospection: true,
      maxQueryDepth: 15,
      maxQueryComplexity: 1000,
      enableSubscriptions: true,
      subscriptionProtocol: 'ws',
      enableBatching: false,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'endpoint', label: 'GraphQL Endpoint', type: 'text', placeholder: '/graphql' },
          { id: 'port', label: 'Port', type: 'number', placeholder: '4000' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enablePlayground', label: 'Enable GraphQL Playground', type: 'toggle' },
          { id: 'enableIntrospection', label: 'Enable Introspection', type: 'toggle' },
          { id: 'enableSubscriptions', label: 'Enable Subscriptions', type: 'toggle' },
          {
            id: 'subscriptionProtocol',
            label: 'Subscription Protocol',
            type: 'select',
            options: [
              { value: 'ws', label: 'WebSocket' },
              { value: 'sse', label: 'Server-Sent Events' },
            ],
          },
          { id: 'enableBatching', label: 'Enable Query Batching', type: 'toggle' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'maxQueryDepth', label: 'Max Query Depth', type: 'number', placeholder: '15' },
          { id: 'maxQueryComplexity', label: 'Max Query Complexity', type: 'number', placeholder: '1000' },
        ],
      },
    ],
  },
  soap: {
    id: 'soap',
    title: 'SOAP Web Service',
    description: 'Configure SOAP service, WSDL, bindings, and security policies',
    defaults: {
      endpoint: '/soap',
      port: 8080,
      wsdlUrl: '',
      enableWSAddressing: true,
      enableWSReliableMessaging: false,
      enableWSecurity: false,
      securityPolicy: 'none',
      enableMTOM: false,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'endpoint', label: 'SOAP Endpoint', type: 'text', placeholder: '/soap' },
          { id: 'port', label: 'Port', type: 'number', placeholder: '8080' },
          { id: 'wsdlUrl', label: 'WSDL URL', type: 'text', placeholder: 'http://example.com/service.wsdl' },
        ],
      },
      {
        id: 'features',
        title: 'WS-* Features',
        fields: [
          { id: 'enableWSAddressing', label: 'Enable WS-Addressing', type: 'toggle' },
          { id: 'enableWSReliableMessaging', label: 'Enable WS-ReliableMessaging', type: 'toggle' },
          { id: 'enableMTOM', label: 'Enable MTOM', type: 'toggle' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableWSecurity', label: 'Enable WS-Security', type: 'toggle' },
          {
            id: 'securityPolicy',
            label: 'Security Policy',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'username-token', label: 'Username Token' },
              { value: 'x509', label: 'X.509 Certificate' },
              { value: 'saml', label: 'SAML Token' },
            ],
          },
        ],
      },
    ],
  },
  websocket: {
    id: 'websocket',
    title: 'WebSocket Server',
    description: 'Configure WebSocket server, message types, and connection management',
    defaults: {
      port: 8080,
      path: '/ws',
      enableCompression: true,
      maxConnections: 1000,
      pingInterval: 30,
      pongTimeout: 10,
      enableSubprotocols: false,
      subprotocols: [],
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'port', label: 'Port', type: 'number', placeholder: '8080' },
          { id: 'path', label: 'WebSocket Path', type: 'text', placeholder: '/ws' },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'maxConnections', label: 'Max Connections', type: 'number', placeholder: '1000' },
          { id: 'enableCompression', label: 'Enable Compression', type: 'toggle' },
        ],
      },
      {
        id: 'heartbeat',
        title: 'Heartbeat',
        fields: [
          { id: 'pingInterval', label: 'Ping Interval (seconds)', type: 'number', placeholder: '30' },
          { id: 'pongTimeout', label: 'Pong Timeout (seconds)', type: 'number', placeholder: '10' },
        ],
      },
      {
        id: 'protocols',
        title: 'Subprotocols',
        fields: [
          { id: 'enableSubprotocols', label: 'Enable Subprotocols', type: 'toggle' },
          {
            id: 'subprotocols',
            label: 'Subprotocols',
            type: 'list',
            placeholder: 'chat',
            defaultListItem: 'chat',
          },
        ],
      },
    ],
  },
  webhook: {
    id: 'webhook',
    title: 'Webhook Endpoint',
    description: 'Configure webhook endpoint, authentication, retry policies, and event filtering',
    defaults: {
      endpoint: '/webhook',
      port: 8080,
      enableSignatureVerification: true,
      signatureHeader: 'X-Webhook-Signature',
      signatureAlgorithm: 'sha256',
      enableRetry: true,
      maxRetries: 3,
      retryBackoff: 'exponential',
      enableEventFiltering: false,
      allowedEvents: [],
    },
    sections: [
      {
        id: 'endpoint',
        title: 'Endpoint',
        fields: [
          { id: 'endpoint', label: 'Webhook Endpoint', type: 'text', placeholder: '/webhook' },
          { id: 'port', label: 'Port', type: 'number', placeholder: '8080' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableSignatureVerification', label: 'Enable Signature Verification', type: 'toggle' },
          { id: 'signatureHeader', label: 'Signature Header', type: 'text', placeholder: 'X-Webhook-Signature' },
          {
            id: 'signatureAlgorithm',
            label: 'Signature Algorithm',
            type: 'select',
            options: [
              { value: 'sha1', label: 'SHA-1' },
              { value: 'sha256', label: 'SHA-256' },
              { value: 'sha512', label: 'SHA-512' },
            ],
          },
        ],
      },
      {
        id: 'retry',
        title: 'Retry Policy',
        fields: [
          { id: 'enableRetry', label: 'Enable Retry', type: 'toggle' },
          { id: 'maxRetries', label: 'Max Retries', type: 'number', placeholder: '3' },
          {
            id: 'retryBackoff',
            label: 'Retry Backoff',
            type: 'select',
            options: [
              { value: 'linear', label: 'Linear' },
              { value: 'exponential', label: 'Exponential' },
              { value: 'fixed', label: 'Fixed' },
            ],
          },
        ],
      },
      {
        id: 'filtering',
        title: 'Event Filtering',
        fields: [
          { id: 'enableEventFiltering', label: 'Enable Event Filtering', type: 'toggle' },
          {
            id: 'allowedEvents',
            label: 'Allowed Events',
            type: 'list',
            placeholder: 'user.created',
            defaultListItem: 'user.created',
          },
        ],
      },
    ],
  },
};

