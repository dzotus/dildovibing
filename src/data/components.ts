import { ComponentType, ComponentCategory } from '@/types';

export const COMPONENT_LIBRARY: ComponentType[] = [
  // Messaging & Eventing
  { id: 'kafka', type: 'kafka', label: 'Apache Kafka', icon: '📨', color: '#000000', category: 'messaging' },
  { id: 'rabbitmq', type: 'rabbitmq', label: 'RabbitMQ', icon: '🐰', color: '#FF6600', category: 'messaging' },
  { id: 'activemq', type: 'activemq', label: 'ActiveMQ', icon: '✉️', color: '#A1005A', category: 'messaging' },
  { id: 'aws-sqs', type: 'aws-sqs', label: 'AWS SQS', icon: '🟧', color: '#FF9900', category: 'messaging' },
  { id: 'azure-service-bus', type: 'azure-service-bus', label: 'Azure Service Bus', icon: '💠', color: '#0078D7', category: 'messaging' },
  { id: 'gcp-pubsub', type: 'gcp-pubsub', label: 'Google Pub/Sub', icon: '🌈', color: '#4285F4', category: 'messaging' },

  // Integration & API gateways
  { id: 'kong', type: 'kong', label: 'Kong Gateway', icon: '🐒', color: '#003459', category: 'integration' },
  { id: 'apigee', type: 'apigee', label: 'Apigee', icon: '🧩', color: '#F26522', category: 'integration' },
  { id: 'mulesoft', type: 'mulesoft', label: 'MuleSoft', icon: '🐴', color: '#00A0DF', category: 'integration' },
  { id: 'graphql-gateway', type: 'graphql-gateway', label: 'GraphQL Gateway', icon: '🕸️', color: '#E10098', category: 'integration' },
  { id: 'bff-service', type: 'bff-service', label: 'BFF Service', icon: '🧱', color: '#6C5CE7', category: 'integration' },
  { id: 'webhook-relay', type: 'webhook-relay', label: 'Webhook Relay', icon: '📡', color: '#1ABC9C', category: 'integration' },

  // Data & Storage
  { id: 'postgres', type: 'postgres', label: 'PostgreSQL', icon: '🐘', color: '#336791', category: 'data' },
  { id: 'mongodb', type: 'mongodb', label: 'MongoDB', icon: '🍃', color: '#47A248', category: 'data' },
  { id: 'redis', type: 'redis', label: 'Redis', icon: '🔴', color: '#DC382D', category: 'data' },
  { id: 'cassandra', type: 'cassandra', label: 'Apache Cassandra', icon: '👁️', color: '#1287B1', category: 'data' },
  { id: 'clickhouse', type: 'clickhouse', label: 'ClickHouse', icon: '📊', color: '#FFCC00', category: 'data' },
  { id: 'snowflake', type: 'snowflake', label: 'Snowflake', icon: '❄️', color: '#29B5E8', category: 'data' },
  { id: 'elasticsearch', type: 'elasticsearch', label: 'Elasticsearch', icon: '🧠', color: '#00A79D', category: 'data' },
  { id: 's3-datalake', type: 's3-datalake', label: 'S3 Data Lake', icon: '🪣', color: '#FF9900', category: 'data' },

  // Observability
  { id: 'prometheus', type: 'prometheus', label: 'Prometheus', icon: '🧭', color: '#E6522C', category: 'observability' },
  { id: 'grafana', type: 'grafana', label: 'Grafana', icon: '📈', color: '#F56815', category: 'observability' },
  { id: 'loki', type: 'loki', label: 'Loki', icon: '🧪', color: '#7CBA3C', category: 'observability' },
  { id: 'jaeger', type: 'jaeger', label: 'Jaeger', icon: '🕵️', color: '#65D6AD', category: 'observability' },
  { id: 'otel-collector', type: 'otel-collector', label: 'OpenTelemetry Collector', icon: '🛰️', color: '#6E56CF', category: 'observability' },
  { id: 'pagerduty', type: 'pagerduty', label: 'PagerDuty', icon: '🚨', color: '#06AC38', category: 'observability' },

  // Security & IAM
  { id: 'keycloak', type: 'keycloak', label: 'Keycloak', icon: '🛡️', color: '#5C6BC0', category: 'security' },
  { id: 'waf', type: 'waf', label: 'WAF / API Shield', icon: '🧱', color: '#F44336', category: 'security' },
  { id: 'firewall', type: 'firewall', label: 'Firewall', icon: '🔥', color: '#FF7043', category: 'security' },
  { id: 'secrets-vault', type: 'secrets-vault', label: 'Secrets Vault', icon: '🗝️', color: '#009688', category: 'security' },
  { id: 'ids-ips', type: 'ids-ips', label: 'IDS / IPS', icon: '🛰️', color: '#512DA8', category: 'security' },

  // DevOps & Platform
  { id: 'jenkins', type: 'jenkins', label: 'Jenkins', icon: '🤵', color: '#D24939', category: 'devops' },
  { id: 'gitlab-ci', type: 'gitlab-ci', label: 'GitLab CI', icon: '🦊', color: '#FC6D26', category: 'devops' },
  { id: 'argo-cd', type: 'argo-cd', label: 'Argo CD', icon: '🚀', color: '#EF7B45', category: 'devops' },
  { id: 'terraform', type: 'terraform', label: 'Terraform', icon: '🧱', color: '#7B42BC', category: 'devops' },
  { id: 'ansible', type: 'ansible', label: 'Ansible', icon: '🅰️', color: '#000000', category: 'devops' },
  { id: 'harbor', type: 'harbor', label: 'Harbor Registry', icon: '⚓', color: '#3BC1C4', category: 'devops' },

  // Infrastructure & runtime
  { id: 'nginx', type: 'nginx', label: 'NGINX', icon: '🌐', color: '#009639', category: 'infrastructure' },
  { id: 'docker', type: 'docker', label: 'Docker', icon: '🐳', color: '#2496ED', category: 'infrastructure' },
  { id: 'kubernetes', type: 'kubernetes', label: 'Kubernetes', icon: '☸️', color: '#326CE5', category: 'infrastructure' },
  { id: 'haproxy', type: 'haproxy', label: 'HAProxy', icon: '🔁', color: '#009FDF', category: 'infrastructure' },
  { id: 'envoy', type: 'envoy', label: 'Envoy Proxy', icon: '🧭', color: '#D63384', category: 'infrastructure' },
  { id: 'traefik', type: 'traefik', label: 'Traefik', icon: '🦈', color: '#24A1DE', category: 'infrastructure' },

  // Edge & Networking
  { id: 'istio', type: 'istio', label: 'Istio Mesh', icon: '⛵', color: '#466BB0', category: 'edge' },
  { id: 'service-mesh', type: 'service-mesh', label: 'Service Mesh', icon: '🕸️', color: '#5E81AC', category: 'edge' },
  { id: 'api-gateway', type: 'api-gateway', label: 'Cloud API Gateway', icon: '🚪', color: '#FFB300', category: 'edge' },
  { id: 'vpn', type: 'vpn', label: 'VPN Concentrator', icon: '🔐', color: '#2D9CDB', category: 'edge' },
  { id: 'cdn', type: 'cdn', label: 'CDN Edge', icon: '🛰️', color: '#FF5A5F', category: 'edge' },

  // APIs & Protocols
  { id: 'rest', type: 'rest', label: 'REST API', icon: '🔌', color: '#61DAFB', category: 'api' },
  { id: 'grpc', type: 'grpc', label: 'gRPC', icon: '⚡', color: '#244C5A', category: 'api' },
  { id: 'graphql', type: 'graphql', label: 'GraphQL', icon: '🔮', color: '#DE33A6', category: 'api' },
  { id: 'soap', type: 'soap', label: 'SOAP', icon: '🧼', color: '#2196F3', category: 'api' },
  { id: 'websocket', type: 'websocket', label: 'WebSocket', icon: '🔄', color: '#010101', category: 'api' },
  { id: 'webhook', type: 'webhook', label: 'Webhook Endpoint', icon: '📬', color: '#0FA3B1', category: 'api' },

  // ML & Analytics
  { id: 'spark', type: 'spark', label: 'Apache Spark', icon: '⚙️', color: '#E25A1C', category: 'ml' },
  { id: 'tensorflow-serving', type: 'tensorflow-serving', label: 'TensorFlow Serving', icon: '🧠', color: '#FF6F00', category: 'ml' },
  { id: 'pytorch-serve', type: 'pytorch-serve', label: 'PyTorch Serve', icon: '🔥', color: '#EE4C2C', category: 'ml' },
  { id: 'mlflow', type: 'mlflow', label: 'MLflow', icon: '🧪', color: '#4285F4', category: 'ml' },
  { id: 'feature-store', type: 'feature-store', label: 'Feature Store', icon: '📦', color: '#8E44AD', category: 'ml' },

  // Business / Apps
  { id: 'crm', type: 'crm', label: 'CRM System', icon: '🤝', color: '#F39C12', category: 'business' },
  { id: 'erp', type: 'erp', label: 'ERP / SAP', icon: '🏢', color: '#1B75BC', category: 'business' },
  { id: 'payment-gateway', type: 'payment-gateway', label: 'Payment Gateway', icon: '💳', color: '#4CAF50', category: 'business' },
  { id: 'bpmn-engine', type: 'bpmn-engine', label: 'BPMN Engine', icon: '🌀', color: '#34495E', category: 'business' },
  { id: 'rpa-bot', type: 'rpa-bot', label: 'RPA Bot', icon: '🤖', color: '#9B59B6', category: 'business' },
];

export const COMPONENT_CATEGORIES: { id: ComponentCategory; label: string; icon: string }[] = [
  { id: 'messaging', label: 'Messaging & Event Bus', icon: '📨' },
  { id: 'integration', label: 'Integration & API', icon: '🧩' },
  { id: 'data', label: 'Data & Storage', icon: '🗄️' },
  { id: 'observability', label: 'Observability', icon: '📈' },
  { id: 'security', label: 'Security & IAM', icon: '🛡️' },
  { id: 'devops', label: 'DevOps & Platform', icon: '🛠️' },
  { id: 'infrastructure', label: 'Runtime & Infra', icon: '🏗️' },
  { id: 'edge', label: 'Edge & Networking', icon: '🌐' },
  { id: 'api', label: 'Protocols & APIs', icon: '🔌' },
  { id: 'ml', label: 'ML & Analytics', icon: '🧠' },
  { id: 'business', label: 'Business Systems', icon: '🏢' },
] as const;