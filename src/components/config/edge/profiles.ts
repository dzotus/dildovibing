import { ComponentProfile } from '../shared/types';

export const EDGE_PROFILES: Record<string, ComponentProfile> = {
  istio: {
    id: 'istio',
    title: 'Istio Service Mesh',
    description: 'Service mesh for connecting, securing, and managing microservices.',
    badge: 'Service Mesh',
    docsUrl: 'https://istio.io/',
    defaults: {
      controlPlaneVersion: '1.19.0',
      enableMTLS: true,
      mtlsMode: 'STRICT',
      enableTracing: true,
      tracingProvider: 'jaeger',
      enableMetrics: true,
      metricsProvider: 'prometheus',
      enableAccessLog: true,
      enablePolicy: true,
      enableTelemetry: true,
    },
    sections: [
      {
        id: 'control-plane',
        title: 'Control Plane',
        fields: [
          {
            id: 'controlPlaneVersion',
            label: 'Control Plane Version',
            type: 'text',
            placeholder: '1.19.0',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableMTLS',
            label: 'Enable mTLS',
            type: 'toggle',
            description: 'Mutual TLS between services',
          },
          {
            id: 'mtlsMode',
            label: 'mTLS Mode',
            type: 'select',
            options: [
              { label: 'STRICT', value: 'STRICT' },
              { label: 'PERMISSIVE', value: 'PERMISSIVE' },
              { label: 'DISABLE', value: 'DISABLE' },
            ],
            description: 'mTLS enforcement mode',
          },
        ],
      },
      {
        id: 'observability',
        title: 'Observability',
        fields: [
          {
            id: 'enableTracing',
            label: 'Enable Tracing',
            type: 'toggle',
          },
          {
            id: 'tracingProvider',
            label: 'Tracing Provider',
            type: 'select',
            options: [
              { label: 'Jaeger', value: 'jaeger' },
              { label: 'Zipkin', value: 'zipkin' },
              { label: 'Datadog', value: 'datadog' },
            ],
          },
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'metricsProvider',
            label: 'Metrics Provider',
            type: 'select',
            options: [
              { label: 'Prometheus', value: 'prometheus' },
              { label: 'StatsD', value: 'statsd' },
            ],
          },
          {
            id: 'enableAccessLog',
            label: 'Enable Access Log',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'policy',
        title: 'Policy & Telemetry',
        fields: [
          {
            id: 'enablePolicy',
            label: 'Enable Policy',
            type: 'toggle',
            description: 'Traffic policies and access control',
          },
          {
            id: 'enableTelemetry',
            label: 'Enable Telemetry',
            type: 'toggle',
            description: 'Telemetry collection',
          },
        ],
      },
    ],
  },
  'service-mesh': {
    id: 'service-mesh',
    title: 'Service Mesh',
    description: 'Generic service mesh configuration for microservices communication.',
    badge: 'Mesh',
    defaults: {
      meshType: 'istio',
      enableServiceDiscovery: true,
      enableLoadBalancing: true,
      loadBalancingAlgorithm: 'round_robin',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableRetry: true,
      retryAttempts: 3,
      enableTimeout: true,
      timeoutDuration: 5000,
    },
    sections: [
      {
        id: 'mesh',
        title: 'Mesh Configuration',
        fields: [
          {
            id: 'meshType',
            label: 'Mesh Type',
            type: 'select',
            options: [
              { label: 'Istio', value: 'istio' },
              { label: 'Linkerd', value: 'linkerd' },
              { label: 'Consul Connect', value: 'consul' },
            ],
          },
        ],
      },
      {
        id: 'discovery',
        title: 'Service Discovery',
        fields: [
          {
            id: 'enableServiceDiscovery',
            label: 'Enable Service Discovery',
            type: 'toggle',
          },
          {
            id: 'enableLoadBalancing',
            label: 'Enable Load Balancing',
            type: 'toggle',
          },
          {
            id: 'loadBalancingAlgorithm',
            label: 'Load Balancing Algorithm',
            type: 'select',
            options: [
              { label: 'Round Robin', value: 'round_robin' },
              { label: 'Least Connections', value: 'least_conn' },
              { label: 'Random', value: 'random' },
            ],
          },
        ],
      },
      {
        id: 'resilience',
        title: 'Resilience',
        fields: [
          {
            id: 'enableCircuitBreaker',
            label: 'Enable Circuit Breaker',
            type: 'toggle',
          },
          {
            id: 'circuitBreakerThreshold',
            label: 'Circuit Breaker Threshold',
            type: 'number',
            min: 1,
            max: 100,
            description: 'Failures before opening circuit',
          },
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
            id: 'enableTimeout',
            label: 'Enable Timeout',
            type: 'toggle',
          },
          {
            id: 'timeoutDuration',
            label: 'Timeout Duration',
            type: 'number',
            min: 100,
            max: 60000,
            suffix: 'ms',
          },
        ],
      },
    ],
  },
  'api-gateway': {
    id: 'api-gateway',
    title: 'Cloud API Gateway',
    description: 'Managed API gateway for routing, authentication, and rate limiting.',
    badge: 'API Gateway',
    defaults: {
      gatewayType: 'aws',
      region: 'us-east-1',
      enableAuthentication: true,
      authType: 'api-key',
      enableRateLimiting: true,
      rateLimitPerSecond: 100,
      enableThrottling: true,
      throttlingBurst: 200,
      enableCaching: false,
      cacheTTL: 300,
      enableLogging: true,
      enableMetrics: true,
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
              { label: 'AWS API Gateway', value: 'aws' },
              { label: 'Azure API Management', value: 'azure' },
              { label: 'Google Cloud Endpoints', value: 'gcp' },
            ],
          },
          {
            id: 'region',
            label: 'Region',
            type: 'text',
            placeholder: 'us-east-1',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Authentication',
        fields: [
          {
            id: 'enableAuthentication',
            label: 'Enable Authentication',
            type: 'toggle',
          },
          {
            id: 'authType',
            label: 'Auth Type',
            type: 'select',
            options: [
              { label: 'API Key', value: 'api-key' },
              { label: 'OAuth2', value: 'oauth2' },
              { label: 'JWT', value: 'jwt' },
              { label: 'IAM', value: 'iam' },
            ],
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting & Throttling',
        fields: [
          {
            id: 'enableRateLimiting',
            label: 'Enable Rate Limiting',
            type: 'toggle',
          },
          {
            id: 'rateLimitPerSecond',
            label: 'Rate Limit',
            type: 'number',
            min: 1,
            max: 10000,
            suffix: 'req/sec',
          },
          {
            id: 'enableThrottling',
            label: 'Enable Throttling',
            type: 'toggle',
          },
          {
            id: 'throttlingBurst',
            label: 'Throttling Burst',
            type: 'number',
            min: 1,
            max: 10000,
            suffix: 'req',
            description: 'Burst capacity',
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
            description: 'Cache time-to-live',
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          {
            id: 'enableLogging',
            label: 'Enable Logging',
            type: 'toggle',
          },
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
        ],
      },
    ],
  },
  vpn: {
    id: 'vpn',
    title: 'VPN Concentrator',
    description: 'Virtual Private Network concentrator for secure remote access.',
    badge: 'VPN',
    defaults: {
      vpnType: 'ipsec',
      enableSSL: true,
      sslPort: 443,
      enableIPSec: true,
      ipsecPort: 500,
      enableL2TP: false,
      enablePPTP: false,
      enableRadius: false,
      radiusServer: '',
      enableMFA: false,
      mfaProvider: 'totp',
      maxConnections: 1000,
    },
    sections: [
      {
        id: 'protocols',
        title: 'VPN Protocols',
        fields: [
          {
            id: 'vpnType',
            label: 'VPN Type',
            type: 'select',
            options: [
              { label: 'IPSec', value: 'ipsec' },
              { label: 'OpenVPN', value: 'openvpn' },
              { label: 'WireGuard', value: 'wireguard' },
            ],
          },
          {
            id: 'enableSSL',
            label: 'Enable SSL VPN',
            type: 'toggle',
          },
          {
            id: 'sslPort',
            label: 'SSL Port',
            type: 'number',
            min: 1,
            max: 65535,
          },
          {
            id: 'enableIPSec',
            label: 'Enable IPSec',
            type: 'toggle',
          },
          {
            id: 'ipsecPort',
            label: 'IPSec Port',
            type: 'number',
            min: 1,
            max: 65535,
          },
          {
            id: 'enableL2TP',
            label: 'Enable L2TP',
            type: 'toggle',
          },
          {
            id: 'enablePPTP',
            label: 'Enable PPTP',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Authentication',
        fields: [
          {
            id: 'enableRadius',
            label: 'Enable RADIUS',
            type: 'toggle',
          },
          {
            id: 'radiusServer',
            label: 'RADIUS Server',
            type: 'text',
            placeholder: 'radius.example.com',
          },
          {
            id: 'enableMFA',
            label: 'Enable MFA',
            type: 'toggle',
            description: 'Multi-factor authentication',
          },
          {
            id: 'mfaProvider',
            label: 'MFA Provider',
            type: 'select',
            options: [
              { label: 'TOTP', value: 'totp' },
              { label: 'SMS', value: 'sms' },
              { label: 'Email', value: 'email' },
            ],
          },
        ],
      },
      {
        id: 'capacity',
        title: 'Capacity',
        fields: [
          {
            id: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            min: 1,
            max: 10000,
            description: 'Maximum concurrent VPN connections',
          },
        ],
      },
    ],
  },
  cdn: {
    id: 'cdn',
    title: 'CDN Edge',
    description: 'Content Delivery Network for global content distribution.',
    badge: 'CDN',
    defaults: {
      cdnProvider: 'cloudflare',
      enableCaching: true,
      cacheTTL: 3600,
      enableCompression: true,
      compressionType: 'gzip',
      enableSSL: true,
      enableHTTP2: true,
      enableHTTP3: false,
      enablePurge: true,
      enableGeoRouting: false,
      enableDDoSProtection: true,
    },
    sections: [
      {
        id: 'provider',
        title: 'CDN Provider',
        fields: [
          {
            id: 'cdnProvider',
            label: 'Provider',
            type: 'select',
            options: [
              { label: 'Cloudflare', value: 'cloudflare' },
              { label: 'AWS CloudFront', value: 'cloudfront' },
              { label: 'Fastly', value: 'fastly' },
              { label: 'Akamai', value: 'akamai' },
            ],
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
            max: 86400,
            suffix: 'sec',
            description: 'Cache time-to-live',
          },
        ],
      },
      {
        id: 'compression',
        title: 'Compression',
        fields: [
          {
            id: 'enableCompression',
            label: 'Enable Compression',
            type: 'toggle',
          },
          {
            id: 'compressionType',
            label: 'Compression Type',
            type: 'select',
            options: [
              { label: 'gzip', value: 'gzip' },
              { label: 'brotli', value: 'brotli' },
              { label: 'zstd', value: 'zstd' },
            ],
          },
        ],
      },
      {
        id: 'protocols',
        title: 'Protocols',
        fields: [
          {
            id: 'enableSSL',
            label: 'Enable SSL/TLS',
            type: 'toggle',
          },
          {
            id: 'enableHTTP2',
            label: 'Enable HTTP/2',
            type: 'toggle',
          },
          {
            id: 'enableHTTP3',
            label: 'Enable HTTP/3',
            type: 'toggle',
            description: 'QUIC protocol',
          },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          {
            id: 'enablePurge',
            label: 'Enable Cache Purge',
            type: 'toggle',
            description: 'Manually purge cached content',
          },
          {
            id: 'enableGeoRouting',
            label: 'Enable Geo Routing',
            type: 'toggle',
            description: 'Route based on geographic location',
          },
          {
            id: 'enableDDoSProtection',
            label: 'Enable DDoS Protection',
            type: 'toggle',
          },
        ],
      },
    ],
  },
};

