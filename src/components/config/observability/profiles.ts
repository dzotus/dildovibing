import { ComponentProfile } from '../shared/types';

export const OBSERVABILITY_PROFILES: Record<string, ComponentProfile> = {
  prometheus: {
    id: 'prometheus',
    title: 'Prometheus',
    description: 'Time-series database and monitoring system for metrics collection and alerting.',
    badge: 'Metrics',
    docsUrl: 'https://prometheus.io/',
    defaults: {
      scrapeInterval: '15s',
      evaluationInterval: '15s',
      retentionTime: '15d',
      storagePath: '/prometheus',
      enableRemoteWrite: false,
      remoteWriteUrl: '',
      enableAlertmanager: true,
      alertmanagerUrl: 'http://alertmanager:9093',
      targets: ['localhost:9090'],
    },
    sections: [
      {
        id: 'scraping',
        title: 'Scraping Configuration',
        description: 'How Prometheus collects metrics from targets.',
        fields: [
          {
            id: 'scrapeInterval',
            label: 'Scrape Interval',
            type: 'text',
            placeholder: '15s',
            description: 'How often to scrape targets (e.g., 15s, 1m)',
          },
          {
            id: 'evaluationInterval',
            label: 'Evaluation Interval',
            type: 'text',
            placeholder: '15s',
            description: 'How often to evaluate alerting rules',
          },
          {
            id: 'targets',
            label: 'Scrape Targets',
            type: 'list',
            description: 'List of targets to scrape metrics from',
            defaultListItem: 'localhost:9090',
          },
        ],
      },
      {
        id: 'storage',
        title: 'Storage & Retention',
        fields: [
          {
            id: 'retentionTime',
            label: 'Retention Time',
            type: 'text',
            placeholder: '15d',
            description: 'How long to retain metrics (e.g., 15d, 30d)',
          },
          {
            id: 'storagePath',
            label: 'Storage Path',
            type: 'text',
            placeholder: '/prometheus',
          },
        ],
      },
      {
        id: 'remote',
        title: 'Remote Write',
        fields: [
          {
            id: 'enableRemoteWrite',
            label: 'Enable Remote Write',
            type: 'toggle',
            description: 'Forward metrics to remote storage',
          },
          {
            id: 'remoteWriteUrl',
            label: 'Remote Write URL',
            type: 'text',
            placeholder: 'https://remote-storage/api/v1/write',
          },
        ],
      },
      {
        id: 'alerting',
        title: 'Alerting',
        fields: [
          {
            id: 'enableAlertmanager',
            label: 'Enable Alertmanager',
            type: 'toggle',
            description: 'Send alerts to Alertmanager',
          },
          {
            id: 'alertmanagerUrl',
            label: 'Alertmanager URL',
            type: 'text',
            placeholder: 'http://alertmanager:9093',
          },
        ],
      },
    ],
  },
  grafana: {
    id: 'grafana',
    title: 'Grafana',
    description: 'Visualization and analytics platform for metrics, logs, and traces.',
    badge: 'Visualization',
    docsUrl: 'https://grafana.com/',
    defaults: {
      adminUser: 'admin',
      adminPassword: 'admin',
      datasources: ['prometheus'],
      defaultDashboard: 'overview',
      enableAuth: false,
      authProvider: 'ldap',
      enableAlerting: true,
      alertNotificationChannels: ['email', 'slack'],
      theme: 'dark',
    },
    sections: [
      {
        id: 'admin',
        title: 'Administration',
        fields: [
          { id: 'adminUser', label: 'Admin Username', type: 'text' },
          { id: 'adminPassword', label: 'Admin Password', type: 'text' },
          {
            id: 'theme',
            label: 'Default Theme',
            type: 'select',
            options: [
              { label: 'Dark', value: 'dark' },
              { label: 'Light', value: 'light' },
            ],
          },
        ],
      },
      {
        id: 'datasources',
        title: 'Data Sources',
        fields: [
          {
            id: 'datasources',
            label: 'Data Sources',
            type: 'list',
            description: 'Configured data sources (Prometheus, Loki, etc.)',
            defaultListItem: 'prometheus',
          },
          {
            id: 'defaultDashboard',
            label: 'Default Dashboard',
            type: 'text',
            placeholder: 'overview',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Authentication',
        fields: [
          {
            id: 'enableAuth',
            label: 'Enable Authentication',
            type: 'toggle',
          },
          {
            id: 'authProvider',
            label: 'Auth Provider',
            type: 'select',
            options: [
              { label: 'LDAP', value: 'ldap' },
              { label: 'OAuth', value: 'oauth' },
              { label: 'SAML', value: 'saml' },
              { label: 'JWT', value: 'jwt' },
            ],
          },
        ],
      },
      {
        id: 'alerting',
        title: 'Alerting',
        fields: [
          {
            id: 'enableAlerting',
            label: 'Enable Alerting',
            type: 'toggle',
          },
          {
            id: 'alertNotificationChannels',
            label: 'Notification Channels',
            type: 'list',
            description: 'Channels for alert notifications',
            defaultListItem: 'email',
          },
        ],
      },
    ],
  },
  loki: {
    id: 'loki',
    title: 'Loki',
    description: 'Horizontally-scalable log aggregation system inspired by Prometheus.',
    badge: 'Logs',
    docsUrl: 'https://grafana.com/oss/loki/',
    defaults: {
      retentionPeriod: '168h',
      maxStreams: 10000,
      maxLineSize: 256000,
      enableCompression: true,
      compressionType: 'gzip',
      enableAuth: false,
      enableMultiTenancy: false,
      tenants: [],
    },
    sections: [
      {
        id: 'retention',
        title: 'Retention & Limits',
        fields: [
          {
            id: 'retentionPeriod',
            label: 'Retention Period',
            type: 'text',
            placeholder: '168h',
            description: 'How long to retain logs (e.g., 168h = 7 days)',
          },
          {
            id: 'maxStreams',
            label: 'Max Streams',
            type: 'number',
            min: 1000,
            max: 100000,
            description: 'Maximum number of log streams',
          },
          {
            id: 'maxLineSize',
            label: 'Max Line Size',
            type: 'number',
            min: 1024,
            suffix: 'bytes',
            description: 'Maximum size of a single log line',
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
              { label: 'snappy', value: 'snappy' },
              { label: 'lz4', value: 'lz4' },
            ],
          },
        ],
      },
      {
        id: 'multi-tenancy',
        title: 'Multi-Tenancy',
        fields: [
          {
            id: 'enableMultiTenancy',
            label: 'Enable Multi-Tenancy',
            type: 'toggle',
            description: 'Isolate logs by tenant',
          },
          {
            id: 'tenants',
            label: 'Tenants',
            type: 'list',
            description: 'List of tenant identifiers',
            defaultListItem: 'tenant-1',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableAuth',
            label: 'Enable Authentication',
            type: 'toggle',
          },
        ],
      },
    ],
  },
  jaeger: {
    id: 'jaeger',
    title: 'Jaeger',
    description: 'Distributed tracing system for monitoring and troubleshooting microservices.',
    badge: 'Tracing',
    docsUrl: 'https://www.jaegertracing.io/',
    defaults: {
      samplingType: 'probabilistic',
      samplingParam: 0.001,
      storageBackend: 'elasticsearch',
      storageUrl: 'http://elasticsearch:9200',
      enableUIGraphQL: true,
      enableMetrics: true,
      metricsBackend: 'prometheus',
      metricsUrl: 'http://prometheus:9090',
    },
    sections: [
      {
        id: 'sampling',
        title: 'Sampling Configuration',
        description: 'Control which traces are collected.',
        fields: [
          {
            id: 'samplingType',
            label: 'Sampling Type',
            type: 'select',
            options: [
              { label: 'Probabilistic', value: 'probabilistic' },
              { label: 'Rate Limiting', value: 'ratelimiting' },
              { label: 'Per Operation', value: 'peroperation' },
            ],
          },
          {
            id: 'samplingParam',
            label: 'Sampling Parameter',
            type: 'number',
            min: 0,
            max: 1,
            step: 0.001,
            description: 'Probability or rate limit (0.001 = 0.1%)',
          },
        ],
      },
      {
        id: 'storage',
        title: 'Storage Backend',
        fields: [
          {
            id: 'storageBackend',
            label: 'Storage Type',
            type: 'select',
            options: [
              { label: 'Elasticsearch', value: 'elasticsearch' },
              { label: 'Cassandra', value: 'cassandra' },
              { label: 'Kafka', value: 'kafka' },
              { label: 'Memory', value: 'memory' },
            ],
          },
          {
            id: 'storageUrl',
            label: 'Storage URL',
            type: 'text',
            placeholder: 'http://storage:9200',
          },
        ],
      },
      {
        id: 'ui',
        title: 'UI & Metrics',
        fields: [
          {
            id: 'enableUIGraphQL',
            label: 'Enable GraphQL UI',
            type: 'toggle',
            description: 'Enable GraphQL API for UI',
          },
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'metricsBackend',
            label: 'Metrics Backend',
            type: 'select',
            options: [
              { label: 'Prometheus', value: 'prometheus' },
              { label: 'StatsD', value: 'statsd' },
            ],
          },
          {
            id: 'metricsUrl',
            label: 'Metrics URL',
            type: 'text',
            placeholder: 'http://prometheus:9090',
          },
        ],
      },
    ],
  },
  'otel-collector': {
    id: 'otel-collector',
    title: 'OpenTelemetry Collector',
    description: 'Vendor-agnostic observability data pipeline for receiving, processing, and exporting telemetry.',
    badge: 'Telemetry',
    docsUrl: 'https://opentelemetry.io/docs/collector/',
    defaults: {
      receivers: ['otlp', 'prometheus'],
      processors: ['batch', 'memory_limiter'],
      exporters: ['otlp', 'prometheus'],
      otlpEndpoint: 'http://localhost:4317',
      prometheusEndpoint: 'http://localhost:8888',
      batchTimeout: '1s',
      batchSize: 8192,
      memoryLimit: 512,
    },
    sections: [
      {
        id: 'receivers',
        title: 'Receivers',
        description: 'Data sources for telemetry collection.',
        fields: [
          {
            id: 'receivers',
            label: 'Enabled Receivers',
            type: 'list',
            description: 'Receivers to collect data from',
            defaultListItem: 'otlp',
          },
        ],
      },
      {
        id: 'processors',
        title: 'Processors',
        description: 'Data transformation and filtering.',
        fields: [
          {
            id: 'processors',
            label: 'Enabled Processors',
            type: 'list',
            description: 'Processors for data transformation',
            defaultListItem: 'batch',
          },
          {
            id: 'batchTimeout',
            label: 'Batch Timeout',
            type: 'text',
            placeholder: '1s',
            description: 'Timeout for batching (e.g., 1s, 5s)',
          },
          {
            id: 'batchSize',
            label: 'Batch Size',
            type: 'number',
            min: 1,
            max: 100000,
            description: 'Maximum number of spans/metrics per batch',
          },
          {
            id: 'memoryLimit',
            label: 'Memory Limit',
            type: 'number',
            min: 64,
            suffix: 'MB',
            description: 'Memory limit for processing',
          },
        ],
      },
      {
        id: 'exporters',
        title: 'Exporters',
        description: 'Destinations for processed telemetry.',
        fields: [
          {
            id: 'exporters',
            label: 'Enabled Exporters',
            type: 'list',
            description: 'Exporters to send data to',
            defaultListItem: 'otlp',
          },
          {
            id: 'otlpEndpoint',
            label: 'OTLP Endpoint',
            type: 'text',
            placeholder: 'http://backend:4317',
          },
          {
            id: 'prometheusEndpoint',
            label: 'Prometheus Endpoint',
            type: 'text',
            placeholder: 'http://localhost:8888',
          },
        ],
      },
    ],
  },
  pagerduty: {
    id: 'pagerduty',
    title: 'PagerDuty',
    description: 'Incident management and on-call scheduling platform.',
    badge: 'Incident Management',
    docsUrl: 'https://www.pagerduty.com/',
    defaults: {
      integrationKey: '',
      serviceName: 'archiphoenix-service',
      escalationPolicy: 'default',
      enableAutoResolve: true,
      resolveTimeout: 300,
      enableWebhooks: false,
      webhookUrl: '',
      severityMapping: 'standard',
    },
    sections: [
      {
        id: 'integration',
        title: 'Integration',
        fields: [
          {
            id: 'integrationKey',
            label: 'Integration Key',
            type: 'text',
            placeholder: 'your-integration-key',
            description: 'PagerDuty service integration key',
          },
          {
            id: 'serviceName',
            label: 'Service Name',
            type: 'text',
            placeholder: 'my-service',
          },
        ],
      },
      {
        id: 'escalation',
        title: 'Escalation & Resolution',
        fields: [
          {
            id: 'escalationPolicy',
            label: 'Escalation Policy',
            type: 'text',
            placeholder: 'default',
            description: 'Policy name for incident escalation',
          },
          {
            id: 'enableAutoResolve',
            label: 'Auto Resolve',
            type: 'toggle',
            description: 'Automatically resolve incidents when resolved',
          },
          {
            id: 'resolveTimeout',
            label: 'Resolve Timeout',
            type: 'number',
            min: 60,
            max: 3600,
            suffix: 'sec',
            description: 'Time before auto-resolving',
          },
        ],
      },
      {
        id: 'webhooks',
        title: 'Webhooks',
        fields: [
          {
            id: 'enableWebhooks',
            label: 'Enable Webhooks',
            type: 'toggle',
            description: 'Send webhook notifications',
          },
          {
            id: 'webhookUrl',
            label: 'Webhook URL',
            type: 'text',
            placeholder: 'https://webhook.example.com/pagerduty',
          },
        ],
      },
      {
        id: 'severity',
        title: 'Severity Mapping',
        fields: [
          {
            id: 'severityMapping',
            label: 'Severity Mapping',
            type: 'select',
            options: [
              { label: 'Standard', value: 'standard' },
              { label: 'Custom', value: 'custom' },
            ],
            description: 'How to map alert severities',
          },
        ],
      },
    ],
  },
};

