import { ComponentProfile } from '../shared/types';

export const API_PROFILES: Record<string, ComponentProfile> = {
  graphql: {
    id: 'graphql',
    title: 'GraphQL API',
    description: 'Query language and runtime for APIs with flexible data fetching.',
    badge: 'GraphQL',
    docsUrl: 'https://graphql.org/',
    defaults: {
      endpoint: '/graphql',
      enableIntrospection: true,
      enablePlayground: true,
      playgroundPath: '/playground',
      enableSubscriptions: true,
      subscriptionProtocol: 'ws',
      enableQueryComplexity: true,
      maxQueryDepth: 15,
      maxQueryComplexity: 1000,
      enableCaching: false,
      cacheTTL: 300,
    },
    sections: [
      {
        id: 'endpoint',
        title: 'Endpoint Configuration',
        fields: [
          {
            id: 'endpoint',
            label: 'GraphQL Endpoint',
            type: 'text',
            placeholder: '/graphql',
          },
        ],
      },
      {
        id: 'introspection',
        title: 'Introspection & Playground',
        fields: [
          {
            id: 'enableIntrospection',
            label: 'Enable Introspection',
            type: 'toggle',
            description: 'Allow schema introspection queries',
          },
          {
            id: 'enablePlayground',
            label: 'Enable Playground',
            type: 'toggle',
            description: 'GraphQL IDE for testing',
          },
          {
            id: 'playgroundPath',
            label: 'Playground Path',
            type: 'text',
            placeholder: '/playground',
          },
        ],
      },
      {
        id: 'subscriptions',
        title: 'Subscriptions',
        fields: [
          {
            id: 'enableSubscriptions',
            label: 'Enable Subscriptions',
            type: 'toggle',
            description: 'Real-time subscriptions',
          },
          {
            id: 'subscriptionProtocol',
            label: 'Subscription Protocol',
            type: 'select',
            options: [
              { label: 'WebSocket', value: 'ws' },
              { label: 'SSE', value: 'sse' },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Query Security',
        fields: [
          {
            id: 'enableQueryComplexity',
            label: 'Enable Query Complexity',
            type: 'toggle',
            description: 'Limit query complexity',
          },
          {
            id: 'maxQueryDepth',
            label: 'Max Query Depth',
            type: 'number',
            min: 1,
            max: 50,
            description: 'Maximum nesting depth',
          },
          {
            id: 'maxQueryComplexity',
            label: 'Max Query Complexity',
            type: 'number',
            min: 1,
            max: 10000,
            description: 'Maximum complexity score',
          },
        ],
      },
      {
        id: 'caching',
        title: 'Caching',
        fields: [
          {
            id: 'enableCaching',
            label: 'Enable Caching',
            type: 'toggle',
          },
          {
            id: 'cacheTTL',
            label: 'Cache TTL',
            type: 'number',
            min: 1,
            max: 3600,
            suffix: 'sec',
          },
        ],
      },
    ],
  },
  soap: {
    id: 'soap',
    title: 'SOAP API',
    description: 'Simple Object Access Protocol for XML-based web services.',
    badge: 'SOAP',
    defaults: {
      endpoint: '/soap',
      wsdlPath: '/wsdl',
      enableWSDL: true,
      enableWSAddressing: true,
      enableMTOM: false,
      enableSecurity: true,
      securityType: 'ws-security',
      enableLogging: true,
      enableValidation: true,
    },
    sections: [
      {
        id: 'endpoint',
        title: 'Endpoint Configuration',
        fields: [
          {
            id: 'endpoint',
            label: 'SOAP Endpoint',
            type: 'text',
            placeholder: '/soap',
          },
          {
            id: 'wsdlPath',
            label: 'WSDL Path',
            type: 'text',
            placeholder: '/wsdl',
          },
        ],
      },
      {
        id: 'wsdl',
        title: 'WSDL',
        fields: [
          {
            id: 'enableWSDL',
            label: 'Enable WSDL',
            type: 'toggle',
            description: 'Expose WSDL definition',
          },
          {
            id: 'enableWSAddressing',
            label: 'Enable WS-Addressing',
            type: 'toggle',
            description: 'WS-Addressing support',
          },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          {
            id: 'enableMTOM',
            label: 'Enable MTOM',
            type: 'toggle',
            description: 'Message Transmission Optimization Mechanism',
          },
          {
            id: 'enableValidation',
            label: 'Enable Validation',
            type: 'toggle',
            description: 'Validate SOAP messages',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableSecurity',
            label: 'Enable Security',
            type: 'toggle',
          },
          {
            id: 'securityType',
            label: 'Security Type',
            type: 'select',
            options: [
              { label: 'WS-Security', value: 'ws-security' },
              { label: 'SSL/TLS', value: 'ssl' },
              { label: 'Basic Auth', value: 'basic' },
            ],
          },
        ],
      },
      {
        id: 'logging',
        title: 'Logging',
        fields: [
          {
            id: 'enableLogging',
            label: 'Enable Logging',
            type: 'toggle',
            description: 'Log SOAP requests/responses',
          },
        ],
      },
    ],
  },
  webhook: {
    id: 'webhook',
    title: 'Webhook Endpoint',
    description: 'HTTP callback endpoint for event-driven integrations.',
    badge: 'Webhook',
    defaults: {
      endpoint: '/webhook',
      httpMethod: 'POST',
      enableSignature: true,
      signatureHeader: 'X-Signature',
      signatureAlgorithm: 'sha256',
      enableRetry: true,
      retryAttempts: 3,
      retryBackoff: 'exponential',
      enableTimeout: true,
      timeoutDuration: 30000,
      enableRateLimiting: false,
      rateLimitPerMinute: 100,
    },
    sections: [
      {
        id: 'endpoint',
        title: 'Endpoint Configuration',
        fields: [
          {
            id: 'endpoint',
            label: 'Webhook Endpoint',
            type: 'text',
            placeholder: '/webhook',
          },
          {
            id: 'httpMethod',
            label: 'HTTP Method',
            type: 'select',
            options: [
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableSignature',
            label: 'Enable Signature Verification',
            type: 'toggle',
            description: 'Verify webhook signatures',
          },
          {
            id: 'signatureHeader',
            label: 'Signature Header',
            type: 'text',
            placeholder: 'X-Signature',
          },
          {
            id: 'signatureAlgorithm',
            label: 'Signature Algorithm',
            type: 'select',
            options: [
              { label: 'SHA256', value: 'sha256' },
              { label: 'SHA512', value: 'sha512' },
              { label: 'HMAC-SHA256', value: 'hmac-sha256' },
            ],
          },
        ],
      },
      {
        id: 'reliability',
        title: 'Reliability',
        fields: [
          {
            id: 'enableRetry',
            label: 'Enable Retry',
            type: 'toggle',
          },
          {
            id: 'retryAttempts',
            label: 'Retry Attempts',
            type: 'number',
            min: 1,
            max: 10,
          },
          {
            id: 'retryBackoff',
            label: 'Retry Backoff',
            type: 'select',
            options: [
              { label: 'Exponential', value: 'exponential' },
              { label: 'Linear', value: 'linear' },
              { label: 'Constant', value: 'constant' },
            ],
          },
          {
            id: 'enableTimeout',
            label: 'Enable Timeout',
            type: 'toggle',
          },
          {
            id: 'timeoutDuration',
            label: 'Timeout Duration',
            type: 'number',
            min: 1000,
            max: 300000,
            suffix: 'ms',
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting',
        fields: [
          {
            id: 'enableRateLimiting',
            label: 'Enable Rate Limiting',
            type: 'toggle',
          },
          {
            id: 'rateLimitPerMinute',
            label: 'Rate Limit',
            type: 'number',
            min: 1,
            max: 10000,
            suffix: 'req/min',
          },
        ],
      },
    ],
  },
};

