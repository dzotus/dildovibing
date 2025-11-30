import { ComponentProfile } from '@/components/config/shared/types';

export const EDGE_PROFILES: Record<string, ComponentProfile> = {
  istio: {
    id: 'istio',
    title: 'Istio Service Mesh',
    description: 'Configure Istio mesh, virtual services, destination rules, and traffic policies',
    defaults: {
      namespace: 'istio-system',
      enableMTLS: true,
      enableTracing: true,
      tracingProvider: 'jaeger',
      enableMetrics: true,
      enableAccessLog: true,
      circuitBreakerEnabled: false,
      maxConnections: 100,
      maxPendingRequests: 10,
      timeout: '30s',
    },
    sections: [
      {
        id: 'mesh',
        title: 'Mesh Configuration',
        fields: [
          { id: 'namespace', label: 'Namespace', type: 'text', placeholder: 'istio-system' },
          { id: 'enableMTLS', label: 'Enable mTLS', type: 'toggle' },
        ],
      },
      {
        id: 'observability',
        title: 'Observability',
        fields: [
          { id: 'enableTracing', label: 'Enable Tracing', type: 'toggle' },
          {
            id: 'tracingProvider',
            label: 'Tracing Provider',
            type: 'select',
            options: [
              { value: 'jaeger', label: 'Jaeger' },
              { value: 'zipkin', label: 'Zipkin' },
              { value: 'datadog', label: 'Datadog' },
            ],
          },
          { id: 'enableMetrics', label: 'Enable Metrics', type: 'toggle' },
          { id: 'enableAccessLog', label: 'Enable Access Log', type: 'toggle' },
        ],
      },
      {
        id: 'resilience',
        title: 'Resilience',
        fields: [
          { id: 'circuitBreakerEnabled', label: 'Enable Circuit Breaker', type: 'toggle' },
          { id: 'maxConnections', label: 'Max Connections', type: 'number', placeholder: '100' },
          { id: 'maxPendingRequests', label: 'Max Pending Requests', type: 'number', placeholder: '10' },
          { id: 'timeout', label: 'Request Timeout', type: 'text', placeholder: '30s' },
        ],
      },
    ],
  },
  'service-mesh': {
    id: 'service-mesh',
    title: 'Service Mesh',
    description: 'Configure service mesh policies, traffic management, and security',
    defaults: {
      meshType: 'istio',
      enableServiceDiscovery: true,
      enableLoadBalancing: true,
      loadBalancingAlgorithm: 'round_robin',
      enableRetry: true,
      maxRetries: 3,
      retryTimeout: '1s',
      enableCircuitBreaker: false,
    },
    sections: [
      {
        id: 'mesh',
        title: 'Mesh Type',
        fields: [
          {
            id: 'meshType',
            label: 'Mesh Type',
            type: 'select',
            options: [
              { value: 'istio', label: 'Istio' },
              { value: 'linkerd', label: 'Linkerd' },
              { value: 'consul', label: 'Consul Connect' },
            ],
          },
        ],
      },
      {
        id: 'discovery',
        title: 'Service Discovery',
        fields: [
          { id: 'enableServiceDiscovery', label: 'Enable Service Discovery', type: 'toggle' },
        ],
      },
      {
        id: 'traffic',
        title: 'Traffic Management',
        fields: [
          { id: 'enableLoadBalancing', label: 'Enable Load Balancing', type: 'toggle' },
          {
            id: 'loadBalancingAlgorithm',
            label: 'Load Balancing Algorithm',
            type: 'select',
            options: [
              { value: 'round_robin', label: 'Round Robin' },
              { value: 'least_conn', label: 'Least Connections' },
              { value: 'random', label: 'Random' },
              { value: 'consistent_hash', label: 'Consistent Hash' },
            ],
          },
        ],
      },
      {
        id: 'resilience',
        title: 'Resilience',
        fields: [
          { id: 'enableRetry', label: 'Enable Retry', type: 'toggle' },
          { id: 'maxRetries', label: 'Max Retries', type: 'number', placeholder: '3' },
          { id: 'retryTimeout', label: 'Retry Timeout', type: 'text', placeholder: '1s' },
          { id: 'enableCircuitBreaker', label: 'Enable Circuit Breaker', type: 'toggle' },
        ],
      },
    ],
  },
  'api-gateway': {
    id: 'api-gateway',
    title: 'Cloud API Gateway',
    description: 'Configure API gateway routes, authentication, rate limiting, and caching',
    defaults: {
      gatewayType: 'aws',
      baseUrl: 'https://api.example.com',
      enableAuthentication: true,
      authType: 'api-key',
      enableRateLimiting: true,
      rateLimitPerSecond: 100,
      enableCaching: true,
      cacheTTL: 300,
      enableCORS: true,
      allowedOrigins: ['*'],
    },
    sections: [
      {
        id: 'gateway',
        title: 'Gateway Configuration',
        fields: [
          {
            id: 'gatewayType',
            label: 'Gateway Type',
            type: 'select',
            options: [
              { value: 'aws', label: 'AWS API Gateway' },
              { value: 'azure', label: 'Azure API Management' },
              { value: 'gcp', label: 'GCP API Gateway' },
              { value: 'kong', label: 'Kong' },
            ],
          },
          { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com' },
        ],
      },
      {
        id: 'authentication',
        title: 'Authentication',
        fields: [
          { id: 'enableAuthentication', label: 'Enable Authentication', type: 'toggle' },
          {
            id: 'authType',
            label: 'Authentication Type',
            type: 'select',
            options: [
              { value: 'api-key', label: 'API Key' },
              { value: 'oauth2', label: 'OAuth 2.0' },
              { value: 'jwt', label: 'JWT' },
              { value: 'basic', label: 'Basic Auth' },
            ],
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting',
        fields: [
          { id: 'enableRateLimiting', label: 'Enable Rate Limiting', type: 'toggle' },
          { id: 'rateLimitPerSecond', label: 'Requests Per Second', type: 'number', placeholder: '100' },
        ],
      },
      {
        id: 'caching',
        title: 'Caching',
        fields: [
          { id: 'enableCaching', label: 'Enable Caching', type: 'toggle' },
          { id: 'cacheTTL', label: 'Cache TTL (seconds)', type: 'number', placeholder: '300' },
        ],
      },
      {
        id: 'cors',
        title: 'CORS',
        fields: [
          { id: 'enableCORS', label: 'Enable CORS', type: 'toggle' },
          {
            id: 'allowedOrigins',
            label: 'Allowed Origins',
            type: 'list',
            placeholder: '*',
            defaultListItem: '*',
          },
        ],
      },
    ],
  },
  vpn: {
    id: 'vpn',
    title: 'VPN Concentrator',
    description: 'Configure VPN server, protocols, encryption, and client access',
    defaults: {
      serverAddress: 'vpn.example.com',
      vpnProtocol: 'openvpn',
      port: 1194,
      encryption: 'AES-256',
      enableCompression: true,
      enableLZO: false,
      maxClients: 100,
      enableLogging: true,
      enableKillSwitch: true,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverAddress', label: 'Server Address', type: 'text', placeholder: 'vpn.example.com' },
          { id: 'port', label: 'Port', type: 'number', placeholder: '1194' },
          {
            id: 'vpnProtocol',
            label: 'VPN Protocol',
            type: 'select',
            options: [
              { value: 'openvpn', label: 'OpenVPN' },
              { value: 'ipsec', label: 'IPSec' },
              { value: 'wireguard', label: 'WireGuard' },
              { value: 'pptp', label: 'PPTP' },
            ],
          },
        ],
      },
      {
        id: 'encryption',
        title: 'Encryption',
        fields: [
          {
            id: 'encryption',
            label: 'Encryption Algorithm',
            type: 'select',
            options: [
              { value: 'AES-128', label: 'AES-128' },
              { value: 'AES-256', label: 'AES-256' },
              { value: 'ChaCha20', label: 'ChaCha20' },
              { value: 'Blowfish', label: 'Blowfish' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'enableCompression', label: 'Enable Compression', type: 'toggle' },
          { id: 'enableLZO', label: 'Enable LZO Compression', type: 'toggle' },
        ],
      },
      {
        id: 'clients',
        title: 'Client Management',
        fields: [
          { id: 'maxClients', label: 'Max Concurrent Clients', type: 'number', placeholder: '100' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableLogging', label: 'Enable Logging', type: 'toggle' },
          { id: 'enableKillSwitch', label: 'Enable Kill Switch', type: 'toggle' },
        ],
      },
    ],
  },
  cdn: {
    id: 'cdn',
    title: 'CDN Edge',
    description: 'Configure CDN caching, compression, SSL, and geographic distribution',
    defaults: {
      cdnProvider: 'cloudflare',
      originUrl: 'https://origin.example.com',
      enableCaching: true,
      cacheTTL: 3600,
      enableCompression: true,
      enableSSL: true,
      enableHTTP2: true,
      enableHTTP3: false,
      enableMinification: true,
      enableImageOptimization: true,
    },
    sections: [
      {
        id: 'provider',
        title: 'CDN Provider',
        fields: [
          {
            id: 'cdnProvider',
            label: 'CDN Provider',
            type: 'select',
            options: [
              { value: 'cloudflare', label: 'Cloudflare' },
              { value: 'aws-cloudfront', label: 'AWS CloudFront' },
              { value: 'azure-cdn', label: 'Azure CDN' },
              { value: 'fastly', label: 'Fastly' },
            ],
          },
          { id: 'originUrl', label: 'Origin URL', type: 'text', placeholder: 'https://origin.example.com' },
        ],
      },
      {
        id: 'caching',
        title: 'Caching',
        fields: [
          { id: 'enableCaching', label: 'Enable Caching', type: 'toggle' },
          { id: 'cacheTTL', label: 'Cache TTL (seconds)', type: 'number', placeholder: '3600' },
        ],
      },
      {
        id: 'optimization',
        title: 'Optimization',
        fields: [
          { id: 'enableCompression', label: 'Enable Compression', type: 'toggle' },
          { id: 'enableMinification', label: 'Enable Minification', type: 'toggle' },
          { id: 'enableImageOptimization', label: 'Enable Image Optimization', type: 'toggle' },
        ],
      },
      {
        id: 'protocols',
        title: 'Protocols',
        fields: [
          { id: 'enableSSL', label: 'Enable SSL/TLS', type: 'toggle' },
          { id: 'enableHTTP2', label: 'Enable HTTP/2', type: 'toggle' },
          { id: 'enableHTTP3', label: 'Enable HTTP/3', type: 'toggle' },
        ],
      },
    ],
  },
};

