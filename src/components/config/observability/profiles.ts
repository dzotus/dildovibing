import { ComponentProfile } from '@/components/config/shared/types';

export const OBSERVABILITY_PROFILES: Record<string, ComponentProfile> = {
  prometheus: {
    id: 'prometheus',
    title: 'Prometheus Metrics',
    description: 'Configure Prometheus server, scrape targets, and retention policies',
    defaults: {
      serverUrl: 'http://localhost:9090',
      scrapeInterval: '15s',
      evaluationInterval: '15s',
      retentionTime: '15d',
      storagePath: '/prometheus',
      externalLabels: {},
      alertmanagerUrl: '',
      enableRemoteWrite: false,
      remoteWriteUrl: '',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:9090' },
          { id: 'storagePath', label: 'Storage Path', type: 'text', placeholder: '/prometheus' },
          { id: 'scrapeInterval', label: 'Scrape Interval', type: 'text', placeholder: '15s' },
          { id: 'evaluationInterval', label: 'Evaluation Interval', type: 'text', placeholder: '15s' },
          { id: 'retentionTime', label: 'Retention Time', type: 'text', placeholder: '15d' },
        ],
      },
      {
        id: 'targets',
        title: 'Scrape Targets',
        fields: [
          {
            id: 'scrapeTargets',
            label: 'Target Endpoints',
            type: 'list',
            placeholder: 'http://localhost:8080/metrics',
            defaultListItem: 'http://localhost:8080/metrics',
          },
        ],
      },
      {
        id: 'alerts',
        title: 'Alerting',
        fields: [
          { id: 'alertmanagerUrl', label: 'Alertmanager URL', type: 'text', placeholder: 'http://alertmanager:9093' },
        ],
      },
      {
        id: 'remote',
        title: 'Remote Write',
        fields: [
          { id: 'enableRemoteWrite', label: 'Enable Remote Write', type: 'toggle' },
          { id: 'remoteWriteUrl', label: 'Remote Write URL', type: 'text', placeholder: 'https://remote-prometheus:9090/api/v1/write' },
        ],
      },
      {
        id: 'metrics',
        title: 'Metrics & Queries',
        description: 'Define custom metrics and PromQL queries',
        fields: [
          {
            id: 'customMetrics',
            label: 'Custom Metrics (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "http_requests_total", "type": "counter", "labels": ["method", "status"]}]',
            placeholder: '[{"name": "http_requests_total", "type": "counter", "labels": ["method", "status"], "help": "Total HTTP requests"}]',
            rows: 10,
          },
        ],
      },
      {
        id: 'queries',
        title: 'PromQL Queries',
        description: 'Define common PromQL queries for monitoring',
        fields: [
          {
            id: 'queries',
            label: 'Queries (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "request_rate", "query": "rate(http_requests_total[5m])"}]',
            placeholder: '[{"name": "request_rate", "query": "rate(http_requests_total[5m])"}, {"name": "error_rate", "query": "rate(http_requests_total{status=~\\"5..\\"}[5m])"}]',
            rows: 10,
          },
        ],
      },
      {
        id: 'alertRules',
        title: 'Alert Rules',
        description: 'Define Prometheus alerting rules',
        fields: [
          {
            id: 'alertRules',
            label: 'Alert Rules (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"alert": "HighErrorRate", "expr": "...", "for": "5m", "labels": {...}}]',
            placeholder: '[{"alert": "HighErrorRate", "expr": "rate(http_requests_total{status=~"5.."}[5m]) > 0.1", "for": "5m", "labels": {"severity": "critical"}, "annotations": {"summary": "High error rate detected"}}]',
            rows: 12,
          },
        ],
      },
    ],
  },
  grafana: {
    id: 'grafana',
    title: 'Grafana Dashboards',
    description: 'Configure Grafana instance, data sources, and dashboard settings',
    defaults: {
      serverUrl: 'http://localhost:3000',
      adminUser: 'admin',
      adminPassword: '',
      defaultDataSource: 'prometheus',
      datasources: ['prometheus', 'loki'],
      dashboardRefreshInterval: '30s',
      enableAnonymousAccess: false,
      organizationName: 'Main Org',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:3000' },
          { id: 'adminUser', label: 'Admin Username', type: 'text', placeholder: 'admin' },
          { id: 'adminPassword', label: 'Admin Password', type: 'password', placeholder: '••••••••' },
          { id: 'organizationName', label: 'Organization Name', type: 'text', placeholder: 'Main Org' },
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
            placeholder: 'prometheus',
            defaultListItem: 'prometheus',
          },
          {
            id: 'defaultDataSource',
            label: 'Default Data Source',
            type: 'select',
            options: [
              { value: 'prometheus', label: 'Prometheus' },
              { value: 'loki', label: 'Loki' },
              { value: 'jaeger', label: 'Jaeger' },
              { value: 'elasticsearch', label: 'Elasticsearch' },
            ],
          },
        ],
      },
      {
        id: 'dashboards',
        title: 'Dashboard Settings',
        fields: [
          { id: 'dashboardRefreshInterval', label: 'Default Refresh Interval', type: 'text', placeholder: '30s' },
          { id: 'enableAnonymousAccess', label: 'Enable Anonymous Access', type: 'toggle' },
        ],
      },
      {
        id: 'dashboardsConfig',
        title: 'Dashboards Configuration',
        description: 'Define Grafana dashboards with panels and queries',
        fields: [
          {
            id: 'dashboards',
            label: 'Dashboards (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "System Overview", "panels": [{"title": "CPU Usage", "query": "..."}]}]',
            placeholder: '[{"name": "System Overview", "panels": [{"title": "CPU Usage", "query": "100 - (avg(irate(node_cpu_seconds_total{mode=\\"idle\\"}[5m])) * 100)", "type": "graph"}, {"title": "Memory", "query": "node_memory_MemTotal_bytes - node_memory_MemFree_bytes", "type": "graph"}]}]',
            rows: 12,
          },
        ],
      },
      {
        id: 'dataSourceConfigs',
        title: 'Data Source Configurations',
        description: 'Detailed data source configurations',
        fields: [
          {
            id: 'dataSourceConfigs',
            label: 'Data Source Configs (JSON)',
            type: 'textarea',
            description: 'JSON object: {"prometheus": {"url": "...", "auth": {...}}, "loki": {...}}',
            placeholder: '{"prometheus": {"url": "http://prometheus:9090", "auth": {"type": "basic", "username": "admin"}}, "loki": {"url": "http://loki:3100"}}',
            rows: 10,
          },
        ],
      },
    ],
  },
  loki: {
    id: 'loki',
    title: 'Loki Log Aggregation',
    description: 'Configure Loki log collection, retention, and query settings',
    defaults: {
      serverUrl: 'http://localhost:3100',
      storagePath: '/loki',
      retentionPeriod: '168h',
      maxQueryLength: '721h',
      maxQueryParallelism: 32,
      enableCompression: true,
      enableMultiTenancy: false,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:3100' },
          { id: 'storagePath', label: 'Storage Path', type: 'text', placeholder: '/loki' },
          { id: 'retentionPeriod', label: 'Retention Period', type: 'text', placeholder: '168h' },
        ],
      },
      {
        id: 'query',
        title: 'Query Settings',
        fields: [
          { id: 'maxQueryLength', label: 'Max Query Length', type: 'text', placeholder: '721h' },
          { id: 'maxQueryParallelism', label: 'Max Query Parallelism', type: 'number', placeholder: '32' },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'enableCompression', label: 'Enable Compression', type: 'toggle' },
          { id: 'enableMultiTenancy', label: 'Enable Multi-Tenancy', type: 'toggle' },
        ],
      },
      {
        id: 'logQueries',
        title: 'LogQL Queries',
        description: 'Define common LogQL queries for log analysis',
        fields: [
          {
            id: 'queries',
            label: 'LogQL Queries (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "error_logs", "query": "{level=\\"error\\"}"}]',
            placeholder: '[{"name": "error_logs", "query": "{level=\\"error\\"}"}, {"name": "api_errors", "query": "{app=\\"api\\"} |= \\"error\\" | json | status >= 500"}]',
            rows: 10,
          },
        ],
      },
      {
        id: 'labels',
        title: 'Label Configuration',
        description: 'Define log labels and label matchers',
        fields: [
          {
            id: 'labels',
            label: 'Labels (JSON)',
            type: 'textarea',
            description: 'JSON object: {"app": ["api", "web"], "env": ["prod", "staging"]}',
            placeholder: '{"app": ["api", "web", "worker"], "env": ["prod", "staging"], "level": ["error", "warn", "info"]}',
            rows: 8,
          },
        ],
      },
    ],
  },
  jaeger: {
    id: 'jaeger',
    title: 'Jaeger Tracing',
    description: 'Configure Jaeger distributed tracing, sampling, and storage',
    defaults: {
      collectorUrl: 'http://localhost:14268',
      queryUrl: 'http://localhost:16686',
      storageType: 'memory',
      samplingStrategy: 'probabilistic',
      samplingRate: 0.001,
      maxTraces: 100000,
      enableMetrics: true,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'collectorUrl', label: 'Collector URL', type: 'text', placeholder: 'http://localhost:14268' },
          { id: 'queryUrl', label: 'Query UI URL', type: 'text', placeholder: 'http://localhost:16686' },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        fields: [
          {
            id: 'storageType',
            label: 'Storage Type',
            type: 'select',
            options: [
              { value: 'memory', label: 'In-Memory' },
              { value: 'badger', label: 'Badger (Local)' },
              { value: 'elasticsearch', label: 'Elasticsearch' },
              { value: 'cassandra', label: 'Cassandra' },
            ],
          },
        ],
      },
      {
        id: 'sampling',
        title: 'Sampling',
        fields: [
          {
            id: 'samplingStrategy',
            label: 'Sampling Strategy',
            type: 'select',
            options: [
              { value: 'probabilistic', label: 'Probabilistic' },
              { value: 'rateLimiting', label: 'Rate Limiting' },
              { value: 'perOperation', label: 'Per Operation' },
            ],
          },
          { id: 'samplingRate', label: 'Sampling Rate', type: 'number', placeholder: '0.001', step: 0.001, min: 0, max: 1 },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'maxTraces', label: 'Max Traces', type: 'number', placeholder: '100000' },
          { id: 'enableMetrics', label: 'Enable Metrics', type: 'toggle' },
        ],
      },
      {
        id: 'operations',
        title: 'Trace Operations',
        description: 'Define trace operations and their configurations',
        fields: [
          {
            id: 'operations',
            label: 'Operations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "GET /api/users", "service": "api", "tags": {...}}]',
            placeholder: '[{"name": "GET /api/users", "service": "api", "tags": {"http.method": "GET", "http.route": "/api/users"}}, {"name": "db.query", "service": "database", "tags": {"db.type": "postgres"}}]',
            rows: 10,
          },
        ],
      },
      {
        id: 'traceQueries',
        title: 'Trace Queries',
        description: 'Define common trace search queries',
        fields: [
          {
            id: 'queries',
            label: 'Queries (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"name": "slow_queries", "query": "service=api AND duration>1s"}]',
            placeholder: '[{"name": "slow_queries", "query": "service=api AND duration>1s"}, {"name": "error_traces", "query": "status=error"}]',
            rows: 8,
          },
        ],
      },
    ],
  },
  'otel-collector': {
    id: 'otel-collector',
    title: 'OpenTelemetry Collector',
    description: 'Configure OTel collector pipelines, exporters, and processors',
    defaults: {
      receiverPort: 4317,
      exporterEndpoint: '',
      processors: ['batch', 'memory_limiter'],
      exporters: ['otlp'],
      enableMetrics: true,
      enableTraces: true,
      enableLogs: true,
    },
    sections: [
      {
        id: 'receivers',
        title: 'Receivers',
        fields: [
          { id: 'receiverPort', label: 'Receiver Port', type: 'number', placeholder: '4317' },
          {
            id: 'receiverProtocols',
            label: 'Receiver Protocols',
            type: 'list',
            placeholder: 'otlp',
            defaultListItem: 'otlp',
          },
        ],
      },
      {
        id: 'processors',
        title: 'Processors',
        fields: [
          {
            id: 'processors',
            label: 'Active Processors',
            type: 'list',
            placeholder: 'batch',
            defaultListItem: 'batch',
          },
        ],
      },
      {
        id: 'exporters',
        title: 'Exporters',
        fields: [
          {
            id: 'exporters',
            label: 'Exporters',
            type: 'list',
            placeholder: 'otlp',
            defaultListItem: 'otlp',
          },
          { id: 'exporterEndpoint', label: 'Exporter Endpoint', type: 'text', placeholder: 'http://backend:4317' },
        ],
      },
      {
        id: 'telemetry',
        title: 'Telemetry Types',
        fields: [
          { id: 'enableMetrics', label: 'Enable Metrics', type: 'toggle' },
          { id: 'enableTraces', label: 'Enable Traces', type: 'toggle' },
          { id: 'enableLogs', label: 'Enable Logs', type: 'toggle' },
        ],
      },
      {
        id: 'pipelines',
        title: 'Processing Pipelines',
        description: 'Define OTel processing pipelines',
        fields: [
          {
            id: 'pipelines',
            label: 'Pipelines (JSON)',
            type: 'textarea',
            description: 'JSON object: {"metrics": {"receivers": [...], "processors": [...], "exporters": [...]}}',
            placeholder: '{"metrics": {"receivers": ["otlp"], "processors": ["batch", "memory_limiter"], "exporters": ["prometheus"]}, "traces": {"receivers": ["otlp"], "processors": ["batch"], "exporters": ["jaeger"]}}',
            rows: 12,
          },
        ],
      },
      {
        id: 'resources',
        title: 'Resource Attributes',
        description: 'Define resource attributes for telemetry',
        fields: [
          {
            id: 'resources',
            label: 'Resources (JSON)',
            type: 'textarea',
            description: 'JSON object: {"service.name": "api", "service.version": "1.0.0", "deployment.environment": "prod"}',
            placeholder: '{"service.name": "api", "service.version": "1.0.0", "deployment.environment": "prod", "cloud.provider": "aws", "cloud.region": "us-east-1"}',
            rows: 8,
          },
        ],
      },
    ],
  },
  pagerduty: {
    id: 'pagerduty',
    title: 'PagerDuty Alerts',
    description: 'Configure PagerDuty integration, escalation policies, and alert routing',
    defaults: {
      integrationKey: '',
      serviceName: 'Production Service',
      escalationPolicy: 'default',
      urgencyLevel: 'high',
      autoResolve: true,
      enableSnooze: false,
      snoozeDuration: 3600,
    },
    sections: [
      {
        id: 'integration',
        title: 'Integration',
        fields: [
          { id: 'integrationKey', label: 'Integration Key', type: 'password', placeholder: '••••••••' },
          { id: 'serviceName', label: 'Service Name', type: 'text', placeholder: 'Production Service' },
        ],
      },
      {
        id: 'routing',
        title: 'Alert Routing',
        fields: [
          {
            id: 'urgencyLevel',
            label: 'Default Urgency',
            type: 'select',
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ],
          },
          { id: 'escalationPolicy', label: 'Escalation Policy', type: 'text', placeholder: 'default' },
        ],
      },
      {
        id: 'behavior',
        title: 'Alert Behavior',
        fields: [
          { id: 'autoResolve', label: 'Auto-Resolve on Recovery', type: 'toggle' },
          { id: 'enableSnooze', label: 'Enable Snooze', type: 'toggle' },
          { id: 'snoozeDuration', label: 'Snooze Duration (seconds)', type: 'number', placeholder: '3600' },
        ],
      },
      {
        id: 'alertRules',
        title: 'Alert Rules & Filters',
        description: 'Define alert routing rules and filters',
        fields: [
          {
            id: 'alertRules',
            label: 'Alert Rules (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"severity": "critical", "filter": "...", "routing": {...}}]',
            placeholder: '[{"severity": "critical", "filter": "status=critical", "routing": {"escalation": "immediate", "team": "oncall"}}, {"severity": "warning", "filter": "status=warning", "routing": {"escalation": "delayed"}}]',
            rows: 10,
          },
        ],
      },
      {
        id: 'integrations',
        title: 'Integration Configurations',
        description: 'Define multiple service integrations',
        fields: [
          {
            id: 'integrations',
            label: 'Integrations (JSON)',
            type: 'textarea',
            description: 'JSON array: [{"service": "api", "key": "...", "urgency": "high"}]',
            placeholder: '[{"service": "api", "key": "...", "urgency": "high", "escalation": "default"}, {"service": "database", "key": "...", "urgency": "critical"}]',
            rows: 8,
          },
        ],
      },
    ],
  },
};

