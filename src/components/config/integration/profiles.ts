import { ComponentProfile } from '../shared/types';

export const INTEGRATION_PROFILES: Record<string, ComponentProfile> = {
  kong: {
    id: 'kong',
    title: 'Kong API Gateway',
    description: 'Управление сервисами, маршрутами и плагинами авторизации/лимитов.',
    badge: 'Gateway',
    docsUrl: 'https://docs.konghq.com/',
    defaults: {
      adminUrl: 'http://kong:8001',
      serviceName: 'core-service',
      upstreamUrl: 'http://core:8080',
      routePaths: ['/api', '/v1'],
      stripPath: true,
      authPlugin: 'key-auth',
      rateLimitPerMinute: 1000,
      enableLogging: true,
      loggingTarget: 'loki',
    },
    sections: [
      {
        id: 'service',
        title: 'Service & Upstream',
        fields: [
          { id: 'serviceName', label: 'Service Name', type: 'text' },
          { id: 'upstreamUrl', label: 'Upstream URL', type: 'text', placeholder: 'http://service:port' },
          {
            id: 'adminUrl',
            label: 'Admin API URL',
            type: 'text',
            placeholder: 'http://kong:8001',
          },
        ],
      },
      {
        id: 'routes',
        title: 'Routes',
        description: 'Пути и правила маршрутизации.',
        fields: [
          {
            id: 'routePaths',
            label: 'Route Paths',
            type: 'list',
            defaultListItem: '/new-path',
          },
          {
            id: 'stripPath',
            label: 'Strip Path',
            type: 'toggle',
            description: 'Удалять префикс перед проксированием.',
          },
        ],
      },
      {
        id: 'policies',
        title: 'Policies & Plugins',
        fields: [
          {
            id: 'authPlugin',
            label: 'Authorization Plugin',
            type: 'select',
            options: [
              { label: 'Key Auth', value: 'key-auth' },
              { label: 'JWT', value: 'jwt' },
              { label: 'OAuth2', value: 'oauth2' },
              { label: 'mTLS', value: 'mtls' },
            ],
          },
          {
            id: 'rateLimitPerMinute',
            label: 'Rate Limit',
            type: 'number',
            min: 0,
            suffix: 'req/min',
          },
          {
            id: 'enableLogging',
            label: 'Structured Logging',
            type: 'toggle',
          },
          {
            id: 'loggingTarget',
            label: 'Logging Target',
            type: 'select',
            options: [
              { label: 'Loki', value: 'loki' },
              { label: 'Splunk', value: 'splunk' },
              { label: 'STDOUT', value: 'stdout' },
            ],
          },
        ],
      },
      {
        id: 'endpoints',
        title: 'API Endpoints',
        description: 'Define API endpoints and their configurations',
        fields: [
          {
            id: 'endpoints',
            label: 'Endpoints (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"path": "/users", "method": "GET", "upstream": "http://users:8080"}]',
            placeholder: '[{"path": "/users", "method": "GET", "upstream": "http://users:8080", "plugins": ["rate-limiting"]}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'transformations',
        title: 'Request/Response Transformations',
        description: 'Define transformations for requests and responses',
        fields: [
          {
            id: 'transformations',
            label: 'Transformations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"route": "/api", "request": "...", "response": "..."}]',
            placeholder: '[{"route": "/api", "request": "add_header(\'X-Custom\', \'value\')", "response": "..."}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'plugins',
        title: 'Plugin Configurations',
        description: 'Advanced plugin configurations',
        fields: [
          {
            id: 'pluginConfigs',
            label: 'Plugin Configs (JSON)',
            type: 'textarea',
            description: 'JSON object: {"rate-limiting": {...}, "cors": {...}}',
            placeholder: '{"rate-limiting": {"minute": 100}, "cors": {"origins": ["*"]}}',
            rows: 8,
          },
        ],
      },
    ],
  },
  apigee: {
    id: 'apigee',
    title: 'Apigee API Proxy',
    description: 'Описание прокси, лимитов и политик безопасности.',
    badge: 'API Platform',
    docsUrl: 'https://cloud.google.com/apigee',
    defaults: {
      proxyName: 'payments-proxy',
      environment: 'prod',
      basePath: '/payments',
      targetEndpoint: 'https://payments.internal/pay',
      quota: 5000,
      quotaInterval: 60,
      spikeArrest: 100,
      enableOAuth: true,
      jwtIssuer: 'auth.archi',
    },
    sections: [
      {
        id: 'metadata',
        title: 'Proxy Metadata',
        fields: [
          { id: 'proxyName', label: 'Proxy Name', type: 'text' },
          { id: 'environment', label: 'Environment', type: 'text', placeholder: 'dev/stage/prod' },
          { id: 'basePath', label: 'Base Path', type: 'text' },
          { id: 'targetEndpoint', label: 'Target Endpoint', type: 'text' },
        ],
      },
      {
        id: 'quotas',
        title: 'Traffic Controls',
        fields: [
          { id: 'quota', label: 'Quota', type: 'number', suffix: 'req', min: 0 },
          { id: 'quotaInterval', label: 'Quota Interval', type: 'number', suffix: 'sec', min: 1 },
          { id: 'spikeArrest', label: 'Spike Arrest', type: 'number', suffix: 'req/sec', min: 0 },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableOAuth',
            label: 'Enable OAuth',
            type: 'toggle',
          },
          {
            id: 'jwtIssuer',
            label: 'JWT Issuer',
            type: 'text',
            placeholder: 'issuer.example.com',
          },
        ],
      },
      {
        id: 'policies',
        title: 'Policies Configuration',
        description: 'Define API policies and their configurations',
        fields: [
          {
            id: 'policies',
            label: 'Policies (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "quota", "config": {...}}]',
            placeholder: '[{"name": "quota", "config": {"limit": 1000}}, {"name": "spike-arrest", "config": {"rate": 10}}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'transformations',
        title: 'Request/Response Transformations',
        description: 'Define transformations for requests and responses',
        fields: [
          {
            id: 'transformations',
            label: 'Transformations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"flow": "preflow", "type": "javascript", "script": "..."}]',
            placeholder: '[{"flow": "preflow", "type": "javascript", "script": "context.setVariable(\'custom\', \'value\');"}]',
            rows: 8,
          },
        ],
      },
    ],
  },
  mulesoft: {
    id: 'mulesoft',
    title: 'MuleSoft Integration',
    description: 'Параметры Runtime, коннекторы и обработка ошибок.',
    badge: 'Integration',
    docsUrl: 'https://www.mulesoft.com/platform/anypoint-platform',
    defaults: {
      runtimeVersion: '4.6.0',
      workerCount: 2,
      connectors: ['Salesforce', 'SAP'],
      errorStrategy: 'continue',
      reconnectionStrategy: 'exponential',
      auditLogging: true,
    },
    sections: [
      {
        id: 'runtime',
        title: 'Runtime',
        fields: [
          { id: 'runtimeVersion', label: 'Runtime Version', type: 'text' },
          { id: 'workerCount', label: 'Workers', type: 'number', min: 1, max: 16 },
        ],
      },
      {
        id: 'connectors',
        title: 'Connectors',
        fields: [
          {
            id: 'connectors',
            label: 'Enabled Connectors',
            type: 'list',
            defaultListItem: 'New Connector',
          },
        ],
      },
      {
        id: 'resilience',
        title: 'Resilience',
        fields: [
          {
            id: 'errorStrategy',
            label: 'Error Strategy',
            type: 'select',
            options: [
              { label: 'Continue', value: 'continue' },
              { label: 'Rollback', value: 'rollback' },
              { label: 'Propagate', value: 'propagate' },
            ],
          },
          {
            id: 'reconnectionStrategy',
            label: 'Reconnection Strategy',
            type: 'select',
            options: [
              { label: 'Exponential', value: 'exponential' },
              { label: 'Linear', value: 'linear' },
              { label: 'None', value: 'none' },
            ],
          },
          {
            id: 'auditLogging',
            label: 'Audit Logging',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'flows',
        title: 'Integration Flows',
        description: 'Define integration flows and their configurations',
        fields: [
          {
            id: 'flows',
            label: 'Flows (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "order-processing", "connectors": [...], "transformations": [...]}]',
            placeholder: '[{"name": "order-processing", "connectors": ["Salesforce", "SAP"], "transformations": [{"type": "dataweave", "script": "..."}]}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'connectorConfigs',
        title: 'Connector Configurations',
        description: 'Detailed connector configurations',
        fields: [
          {
            id: 'connectorConfigs',
            label: 'Connector Configs (JSON)',
            type: 'textarea',
            description: 'JSON object: {"Salesforce": {...}, "SAP": {...}}',
            placeholder: '{"Salesforce": {"url": "...", "credentials": "..."}, "SAP": {"host": "...", "port": 3000}}',
            rows: 8,
          },
        ],
      },
    ],
  },
  'graphql-gateway': {
    id: 'graphql-gateway',
    title: 'GraphQL Gateway',
    description: 'Конфигурация схемы, федерации и кеширования.',
    badge: 'GraphQL',
    defaults: {
      upstreamGraph: 'accounts',
      schemaSource: 'sdl',
      schemaUrl: 'https://schemas/graph.graphql',
      enableFederation: true,
      federationVersion: '2',
      cacheTtl: 30,
      persistQueries: true,
      subscriptions: true,
    },
    sections: [
      {
        id: 'schema',
        title: 'Schema',
        fields: [
          { id: 'upstreamGraph', label: 'Graph Name', type: 'text' },
          {
            id: 'schemaSource',
            label: 'Schema Source',
            type: 'select',
            options: [
              { label: 'SDL File', value: 'sdl' },
              { label: 'Introspection URL', value: 'introspection' },
              { label: 'Registry', value: 'registry' },
            ],
          },
          { id: 'schemaUrl', label: 'Schema URL / Path', type: 'text' },
        ],
      },
      {
        id: 'federation',
        title: 'Federation',
        fields: [
          {
            id: 'enableFederation',
            label: 'Enable Federation',
            type: 'toggle',
          },
          {
            id: 'federationVersion',
            label: 'Federation Version',
            type: 'select',
            options: [
              { label: 'v1', value: '1' },
              { label: 'v2', value: '2' },
            ],
          },
        ],
      },
      {
        id: 'runtime',
        title: 'Runtime Features',
        fields: [
          { id: 'cacheTtl', label: 'Cache TTL', type: 'number', suffix: 'sec', min: 0 },
          {
            id: 'persistQueries',
            label: 'Persisted Queries',
            type: 'toggle',
          },
          {
            id: 'subscriptions',
            label: 'Subscriptions',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'schema',
        title: 'GraphQL Schema Definition',
        description: 'Define or import GraphQL schema',
        fields: [
          {
            id: 'schemaDefinition',
            label: 'Schema (SDL)',
            type: 'textarea',
            description: 'GraphQL Schema Definition Language',
            placeholder: 'type Query {\n  users: [User!]!\n}\n\ntype User {\n  id: ID!\n  name: String!\n}',
            rows: 12,
          },
        ],
      },
      {
        id: 'resolvers',
        title: 'Resolvers Configuration',
        description: 'Define resolvers and their data sources',
        fields: [
          {
            id: 'resolvers',
            label: 'Resolvers (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"field": "users", "dataSource": "http://users:8080/graphql"}]',
            placeholder: '[{"field": "users", "dataSource": "http://users:8080/graphql", "cache": true}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'queries',
        title: 'Persisted Queries',
        description: 'Define persisted queries for optimization',
        fields: [
          {
            id: 'persistedQueries',
            label: 'Persisted Queries (JSON)',
            type: 'textarea',
            description: 'JSON object: {"query1": "query { users { id } }"}',
            placeholder: '{"getUsers": "query { users { id name } }", "getUser": "query($id: ID!) { user(id: $id) { id name } }"}',
            rows: 8,
          },
        ],
      },
    ],
  },
  'bff-service': {
    id: 'bff-service',
    title: 'Backend For Frontend',
    description: 'Сборка данных для конкретных клиентов (mobile/web).',
    badge: 'BFF',
    defaults: {
      audience: 'mobile',
      upstreams: ['catalog', 'cart', 'profile'],
      cacheMode: 'memory',
      cacheTtl: 5,
      fallbackEnabled: true,
      fallbackComponent: 'cached-response',
    },
    sections: [
      {
        id: 'audience',
        title: 'Audience',
        fields: [
          {
            id: 'audience',
            label: 'Primary Audience',
            type: 'select',
            options: [
              { label: 'Mobile', value: 'mobile' },
              { label: 'Web', value: 'web' },
              { label: 'Partner API', value: 'partner' },
            ],
          },
        ],
      },
      {
        id: 'upstreams',
        title: 'Aggregated Upstreams',
        fields: [
          {
            id: 'upstreams',
            label: 'Services',
            type: 'list',
            defaultListItem: 'new-service',
          },
        ],
      },
      {
        id: 'caching',
        title: 'Caching & Fallback',
        fields: [
          {
            id: 'cacheMode',
            label: 'Cache Mode',
            type: 'select',
            options: [
              { label: 'In-memory', value: 'memory' },
              { label: 'Redis', value: 'redis' },
              { label: 'Disabled', value: 'off' },
            ],
          },
          { id: 'cacheTtl', label: 'Cache TTL', type: 'number', suffix: 'sec', min: 0 },
          {
            id: 'fallbackEnabled',
            label: 'Enable Fallback',
            type: 'toggle',
          },
          {
            id: 'fallbackComponent',
            label: 'Fallback Component',
            type: 'text',
            placeholder: 'cached-response',
          },
        ],
      },
      {
        id: 'aggregations',
        title: 'Data Aggregations',
        description: 'Define how to aggregate data from multiple upstreams',
        fields: [
          {
            id: 'aggregations',
            label: 'Aggregations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"endpoint": "/dashboard", "upstreams": [...], "merge": "..."}]',
            placeholder: '[{"endpoint": "/dashboard", "upstreams": ["catalog", "cart", "profile"], "merge": "combine"}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'transformations',
        title: 'Response Transformations',
        description: 'Define transformations for aggregated responses',
        fields: [
          {
            id: 'transformations',
            label: 'Transformations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"endpoint": "/api", "transform": "..."}]',
            placeholder: '[{"endpoint": "/api", "transform": "map(data => ({ id: data.id, name: data.name }))"}]',
            rows: 8,
          },
        ],
      },
    ],
  },
  'webhook-relay': {
    id: 'webhook-relay',
    title: 'Webhook Relay',
    description: 'Прокси входящих вебхуков с ретраями и подписанием.',
    badge: 'Integration',
    defaults: {
      inboundUrl: 'https://hooks.archi.dev/inbound',
      targetUrl: 'https://core.service/webhooks',
      retries: 5,
      retryBackoff: 'exponential',
      signatureSecret: 'super-secret',
      signatureHeader: 'X-Signature',
      allowedIps: ['10.0.0.0/8'],
      transformTemplate: '',
    },
    sections: [
      {
        id: 'endpoints',
        title: 'Endpoints',
        fields: [
          { id: 'inboundUrl', label: 'Inbound URL', type: 'text' },
          { id: 'targetUrl', label: 'Target URL', type: 'text' },
        ],
      },
      {
        id: 'retries',
        title: 'Retries',
        fields: [
          { id: 'retries', label: 'Retry Count', type: 'number', min: 0, max: 10 },
          {
            id: 'retryBackoff',
            label: 'Backoff Strategy',
            type: 'select',
            options: [
              { label: 'Exponential', value: 'exponential' },
              { label: 'Linear', value: 'linear' },
              { label: 'Constant', value: 'constant' },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security & Transform',
        fields: [
          { id: 'signatureSecret', label: 'Signature Secret', type: 'text' },
          { id: 'signatureHeader', label: 'Signature Header', type: 'text' },
          {
            id: 'allowedIps',
            label: 'Allowed IPs',
            type: 'list',
            defaultListItem: '0.0.0.0/0',
          },
          {
            id: 'transformTemplate',
            label: 'Transform Template',
            type: 'textarea',
            placeholder: '{ "payload": {{raw}} }',
          },
        ],
      },
      {
        id: 'webhookEndpoints',
        title: 'Webhook Endpoints',
        description: 'Define multiple webhook endpoints and their configurations',
        fields: [
          {
            id: 'webhookEndpoints',
            label: 'Endpoints (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"path": "/github", "target": "...", "secret": "..."}]',
            placeholder: '[{"path": "/github", "target": "http://ci:8080/webhook", "secret": "github-secret", "events": ["push", "pull_request"]}]',
            rows: 8,
          },
        ],
      },
      {
        id: 'transformations',
        title: 'Webhook Transformations',
        description: 'Define transformations for different webhook sources',
        fields: [
          {
            id: 'transformations',
            label: 'Transformations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"source": "github", "transform": "..."}]',
            placeholder: '[{"source": "github", "transform": "map(event => ({ type: event.type, repo: event.repository.name }))"}]',
            rows: 8,
          },
        ],
      },
    ],
  },
};

