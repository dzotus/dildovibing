import { ComponentProfile } from '../shared/types';

export const INFRASTRUCTURE_PROFILES: Record<string, ComponentProfile> = {
  haproxy: {
    id: 'haproxy',
    title: 'HAProxy',
    description: 'High-performance load balancer and proxy server.',
    badge: 'Load Balancer',
    docsUrl: 'https://www.haproxy.org/',
    defaults: {
      bindAddress: '0.0.0.0',
      bindPort: 80,
      mode: 'http',
      balanceAlgorithm: 'roundrobin',
      backendServers: ['server1:8080', 'server2:8080'],
      enableHealthChecks: true,
      healthCheckInterval: 2000,
      enableSSL: false,
      enableStats: true,
      statsPort: 8404,
    },
    sections: [
      {
        id: 'listener',
        title: 'Listener Configuration',
        fields: [
          {
            id: 'bindAddress',
            label: 'Bind Address',
            type: 'text',
            placeholder: '0.0.0.0',
          },
          {
            id: 'bindPort',
            label: 'Bind Port',
            type: 'number',
            min: 1,
            max: 65535,
          },
          {
            id: 'mode',
            label: 'Mode',
            type: 'select',
            options: [
              { label: 'HTTP', value: 'http' },
              { label: 'TCP', value: 'tcp' },
            ],
          },
        ],
      },
      {
        id: 'backend',
        title: 'Backend Configuration',
        fields: [
          {
            id: 'balanceAlgorithm',
            label: 'Load Balancing Algorithm',
            type: 'select',
            options: [
              { label: 'Round Robin', value: 'roundrobin' },
              { label: 'Least Connections', value: 'leastconn' },
              { label: 'Source IP Hash', value: 'source' },
              { label: 'URI Hash', value: 'uri' },
            ],
          },
          {
            id: 'backendServers',
            label: 'Backend Servers',
            type: 'list',
            description: 'List of backend server addresses',
            defaultListItem: 'server:8080',
          },
        ],
      },
      {
        id: 'health',
        title: 'Health Checks',
        fields: [
          {
            id: 'enableHealthChecks',
            label: 'Enable Health Checks',
            type: 'toggle',
          },
          {
            id: 'healthCheckInterval',
            label: 'Health Check Interval',
            type: 'number',
            min: 1000,
            max: 60000,
            suffix: 'ms',
            description: 'Interval between health checks',
          },
        ],
      },
      {
        id: 'ssl',
        title: 'SSL & Statistics',
        fields: [
          {
            id: 'enableSSL',
            label: 'Enable SSL',
            type: 'toggle',
          },
          {
            id: 'enableStats',
            label: 'Enable Statistics',
            type: 'toggle',
          },
          {
            id: 'statsPort',
            label: 'Stats Port',
            type: 'number',
            min: 1024,
            max: 65535,
            description: 'Port for statistics UI',
          },
        ],
      },
    ],
  },
  envoy: {
    id: 'envoy',
    title: 'Envoy Proxy',
    description: 'Cloud-native edge and service proxy designed for microservices.',
    badge: 'Service Mesh',
    docsUrl: 'https://www.envoyproxy.io/',
    defaults: {
      adminPort: 9901,
      enableAdminInterface: true,
      enableAccessLog: true,
      accessLogPath: '/var/log/envoy/access.log',
      enableMetrics: true,
      metricsPort: 9902,
      enableTracing: false,
      tracingProvider: 'jaeger',
      enableRateLimiting: false,
      rateLimitPerSecond: 100,
      enableCircuitBreaker: true,
      maxConnections: 1024,
    },
    sections: [
      {
        id: 'admin',
        title: 'Admin Interface',
        fields: [
          {
            id: 'adminPort',
            label: 'Admin Port',
            type: 'number',
            min: 1024,
            max: 65535,
            description: 'Port for admin interface',
          },
          {
            id: 'enableAdminInterface',
            label: 'Enable Admin Interface',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'logging',
        title: 'Logging',
        fields: [
          {
            id: 'enableAccessLog',
            label: 'Enable Access Log',
            type: 'toggle',
          },
          {
            id: 'accessLogPath',
            label: 'Access Log Path',
            type: 'text',
            placeholder: '/var/log/envoy/access.log',
          },
        ],
      },
      {
        id: 'metrics',
        title: 'Metrics & Tracing',
        fields: [
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'metricsPort',
            label: 'Metrics Port',
            type: 'number',
            min: 1024,
            max: 65535,
          },
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
        ],
      },
      {
        id: 'resilience',
        title: 'Resilience',
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
            id: 'enableCircuitBreaker',
            label: 'Enable Circuit Breaker',
            type: 'toggle',
          },
          {
            id: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            min: 1,
            max: 100000,
            description: 'Maximum concurrent connections',
          },
        ],
      },
    ],
  },
  traefik: {
    id: 'traefik',
    title: 'Traefik',
    description: 'Modern HTTP reverse proxy and load balancer with automatic SSL.',
    badge: 'Reverse Proxy',
    docsUrl: 'https://doc.traefik.io/traefik/',
    defaults: {
      entryPoints: ['web:80', 'websecure:443'],
      enableDashboard: true,
      dashboardPort: 8080,
      enableAutoSSL: true,
      acmeEmail: 'admin@example.com',
      acmeChallenge: 'http',
      enableKubernetes: false,
      enableDocker: true,
      enableFileProvider: true,
      enableMetrics: true,
      metricsPort: 8081,
    },
    sections: [
      {
        id: 'entrypoints',
        title: 'Entry Points',
        fields: [
          {
            id: 'entryPoints',
            label: 'Entry Points',
            type: 'list',
            description: 'Network entry points (name:port)',
            defaultListItem: 'web:80',
          },
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        fields: [
          {
            id: 'enableDashboard',
            label: 'Enable Dashboard',
            type: 'toggle',
          },
          {
            id: 'dashboardPort',
            label: 'Dashboard Port',
            type: 'number',
            min: 1024,
            max: 65535,
          },
        ],
      },
      {
        id: 'ssl',
        title: 'SSL/TLS',
        fields: [
          {
            id: 'enableAutoSSL',
            label: 'Enable Auto SSL',
            type: 'toggle',
            description: 'Automatic SSL certificate management',
          },
          {
            id: 'acmeEmail',
            label: 'ACME Email',
            type: 'text',
            placeholder: 'admin@example.com',
            description: 'Email for Let\'s Encrypt',
          },
          {
            id: 'acmeChallenge',
            label: 'ACME Challenge',
            type: 'select',
            options: [
              { label: 'HTTP', value: 'http' },
              { label: 'DNS', value: 'dns' },
              { label: 'TLS', value: 'tls' },
            ],
          },
        ],
      },
      {
        id: 'providers',
        title: 'Providers',
        fields: [
          {
            id: 'enableKubernetes',
            label: 'Enable Kubernetes',
            type: 'toggle',
            description: 'Kubernetes ingress provider',
          },
          {
            id: 'enableDocker',
            label: 'Enable Docker',
            type: 'toggle',
            description: 'Docker provider',
          },
          {
            id: 'enableFileProvider',
            label: 'Enable File Provider',
            type: 'toggle',
            description: 'Static file configuration',
          },
        ],
      },
      {
        id: 'metrics',
        title: 'Metrics',
        fields: [
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'metricsPort',
            label: 'Metrics Port',
            type: 'number',
            min: 1024,
            max: 65535,
          },
        ],
      },
    ],
  },
};

