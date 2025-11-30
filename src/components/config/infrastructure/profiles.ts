import { ComponentProfile } from '@/components/config/shared/types';

export const INFRASTRUCTURE_PROFILES: Record<string, ComponentProfile> = {
  nginx: {
    id: 'nginx',
    title: 'NGINX Load Balancer',
    description: 'Configure NGINX server, upstreams, SSL, and load balancing',
    defaults: {
      listenPort: 80,
      serverName: 'localhost',
      workerProcesses: 4,
      workerConnections: 1024,
      enableSSL: false,
      sslPort: 443,
      sslCertificate: '',
      sslKey: '',
      upstreamServers: ['http://backend1:8080', 'http://backend2:8080'],
      loadBalancingMethod: 'round_robin',
      enableGzip: true,
      enableCaching: true,
      cachePath: '/var/cache/nginx',
      config: `server {
  listen 80;
  server_name localhost;

  location / {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'listenPort', label: 'Listen Port', type: 'number', placeholder: '80' },
          { id: 'serverName', label: 'Server Name', type: 'text', placeholder: 'localhost' },
          { id: 'workerProcesses', label: 'Worker Processes', type: 'number', placeholder: '4' },
          { id: 'workerConnections', label: 'Worker Connections', type: 'number', placeholder: '1024' },
        ],
      },
      {
        id: 'ssl',
        title: 'SSL/TLS',
        fields: [
          { id: 'enableSSL', label: 'Enable SSL', type: 'toggle' },
          { id: 'sslPort', label: 'SSL Port', type: 'number', placeholder: '443' },
          { id: 'sslCertificate', label: 'SSL Certificate Path', type: 'text', placeholder: '/etc/ssl/cert.pem' },
          { id: 'sslKey', label: 'SSL Key Path', type: 'text', placeholder: '/etc/ssl/key.pem' },
        ],
      },
      {
        id: 'upstream',
        title: 'Upstream Servers',
        fields: [
          {
            id: 'upstreamServers',
            label: 'Backend Servers',
            type: 'list',
            placeholder: 'http://backend:8080',
            defaultListItem: 'http://backend:8080',
          },
          {
            id: 'loadBalancingMethod',
            label: 'Load Balancing Method',
            type: 'select',
            options: [
              { value: 'round_robin', label: 'Round Robin' },
              { value: 'least_conn', label: 'Least Connections' },
              { value: 'ip_hash', label: 'IP Hash' },
              { value: 'weighted', label: 'Weighted' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'enableGzip', label: 'Enable Gzip Compression', type: 'toggle' },
          { id: 'enableCaching', label: 'Enable Caching', type: 'toggle' },
          { id: 'cachePath', label: 'Cache Path', type: 'text', placeholder: '/var/cache/nginx' },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced Configuration',
        fields: [
          {
            id: 'config',
            label: 'NGINX Config',
            type: 'textarea',
            placeholder: 'server { ... }',
            rows: 15,
          },
        ],
      },
    ],
  },
  docker: {
    id: 'docker',
    title: 'Docker Container',
    description: 'Configure Docker image, ports, volumes, and environment variables',
    defaults: {
      image: 'nginx:latest',
      containerName: 'my-container',
      ports: ['80:80'],
      volumes: [],
      environment: {},
      restartPolicy: 'unless-stopped',
      memoryLimit: '512m',
      cpuLimit: '0.5',
      networkMode: 'bridge',
      dockerfile: `FROM nginx:latest
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
    },
    sections: [
      {
        id: 'image',
        title: 'Image & Container',
        fields: [
          { id: 'image', label: 'Docker Image', type: 'text', placeholder: 'nginx:latest' },
          { id: 'containerName', label: 'Container Name', type: 'text', placeholder: 'my-container' },
        ],
      },
      {
        id: 'ports',
        title: 'Ports',
        fields: [
          {
            id: 'ports',
            label: 'Port Mappings',
            type: 'list',
            placeholder: '80:80',
            defaultListItem: '80:80',
          },
        ],
      },
      {
        id: 'resources',
        title: 'Resources',
        fields: [
          { id: 'memoryLimit', label: 'Memory Limit', type: 'text', placeholder: '512m' },
          { id: 'cpuLimit', label: 'CPU Limit', type: 'text', placeholder: '0.5' },
          {
            id: 'restartPolicy',
            label: 'Restart Policy',
            type: 'select',
            options: [
              { value: 'no', label: 'No' },
              { value: 'always', label: 'Always' },
              { value: 'on-failure', label: 'On Failure' },
              { value: 'unless-stopped', label: 'Unless Stopped' },
            ],
          },
        ],
      },
      {
        id: 'network',
        title: 'Network',
        fields: [
          {
            id: 'networkMode',
            label: 'Network Mode',
            type: 'select',
            options: [
              { value: 'bridge', label: 'Bridge' },
              { value: 'host', label: 'Host' },
              { value: 'none', label: 'None' },
            ],
          },
        ],
      },
      {
        id: 'dockerfile',
        title: 'Dockerfile',
        fields: [
          {
            id: 'dockerfile',
            label: 'Dockerfile Content',
            type: 'textarea',
            placeholder: 'FROM ...',
            rows: 12,
          },
        ],
      },
    ],
  },
  kubernetes: {
    id: 'kubernetes',
    title: 'Kubernetes Cluster',
    description: 'Configure Kubernetes deployment, services, and resource limits',
    defaults: {
      namespace: 'default',
      replicas: 3,
      image: 'nginx:latest',
      containerPort: 80,
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
      cpuRequest: '100m',
      cpuLimit: '500m',
      serviceType: 'ClusterIP',
      enableHPA: false,
      minReplicas: 2,
      maxReplicas: 10,
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: nginx:latest
        ports:
        - containerPort: 80`,
    },
    sections: [
      {
        id: 'deployment',
        title: 'Deployment',
        fields: [
          { id: 'namespace', label: 'Namespace', type: 'text', placeholder: 'default' },
          { id: 'replicas', label: 'Replicas', type: 'number', placeholder: '3' },
          { id: 'image', label: 'Container Image', type: 'text', placeholder: 'nginx:latest' },
          { id: 'containerPort', label: 'Container Port', type: 'number', placeholder: '80' },
        ],
      },
      {
        id: 'resources',
        title: 'Resource Limits',
        fields: [
          { id: 'memoryRequest', label: 'Memory Request', type: 'text', placeholder: '256Mi' },
          { id: 'memoryLimit', label: 'Memory Limit', type: 'text', placeholder: '512Mi' },
          { id: 'cpuRequest', label: 'CPU Request', type: 'text', placeholder: '100m' },
          { id: 'cpuLimit', label: 'CPU Limit', type: 'text', placeholder: '500m' },
        ],
      },
      {
        id: 'service',
        title: 'Service',
        fields: [
          {
            id: 'serviceType',
            label: 'Service Type',
            type: 'select',
            options: [
              { value: 'ClusterIP', label: 'ClusterIP' },
              { value: 'NodePort', label: 'NodePort' },
              { value: 'LoadBalancer', label: 'LoadBalancer' },
              { value: 'ExternalName', label: 'ExternalName' },
            ],
          },
        ],
      },
      {
        id: 'scaling',
        title: 'Auto Scaling',
        fields: [
          { id: 'enableHPA', label: 'Enable HPA', type: 'toggle' },
          { id: 'minReplicas', label: 'Min Replicas', type: 'number', placeholder: '2' },
          { id: 'maxReplicas', label: 'Max Replicas', type: 'number', placeholder: '10' },
        ],
      },
      {
        id: 'yaml',
        title: 'YAML Configuration',
        fields: [
          {
            id: 'yaml',
            label: 'Kubernetes YAML',
            type: 'textarea',
            placeholder: 'apiVersion: ...',
            rows: 15,
          },
        ],
      },
    ],
  },
  haproxy: {
    id: 'haproxy',
    title: 'HAProxy Load Balancer',
    description: 'Configure HAProxy frontend, backend, and load balancing algorithms',
    defaults: {
      frontendPort: 80,
      backendServers: ['server1:8080', 'server2:8080'],
      balanceMethod: 'roundrobin',
      maxConnections: 2000,
      enableStats: true,
      statsPort: 8404,
      enableHealthChecks: true,
      healthCheckInterval: 2000,
      enableSSL: false,
    },
    sections: [
      {
        id: 'frontend',
        title: 'Frontend',
        fields: [
          { id: 'frontendPort', label: 'Frontend Port', type: 'number', placeholder: '80' },
          { id: 'enableSSL', label: 'Enable SSL', type: 'toggle' },
        ],
      },
      {
        id: 'backend',
        title: 'Backend',
        fields: [
          {
            id: 'backendServers',
            label: 'Backend Servers',
            type: 'list',
            placeholder: 'server1:8080',
            defaultListItem: 'server1:8080',
          },
          {
            id: 'balanceMethod',
            label: 'Balance Method',
            type: 'select',
            options: [
              { value: 'roundrobin', label: 'Round Robin' },
              { value: 'leastconn', label: 'Least Connections' },
              { value: 'source', label: 'Source IP' },
              { value: 'uri', label: 'URI' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          { id: 'maxConnections', label: 'Max Connections', type: 'number', placeholder: '2000' },
          { id: 'enableHealthChecks', label: 'Enable Health Checks', type: 'toggle' },
          { id: 'healthCheckInterval', label: 'Health Check Interval (ms)', type: 'number', placeholder: '2000' },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          { id: 'enableStats', label: 'Enable Statistics', type: 'toggle' },
          { id: 'statsPort', label: 'Stats Port', type: 'number', placeholder: '8404' },
        ],
      },
    ],
  },
  envoy: {
    id: 'envoy',
    title: 'Envoy Proxy',
    description: 'Configure Envoy listeners, clusters, routes, and filters',
    defaults: {
      adminPort: 9901,
      listenerPort: 10000,
      clusterName: 'backend_cluster',
      clusterEndpoints: ['127.0.0.1:8080'],
      enableAccessLog: true,
      enableMetrics: true,
      metricsPort: 9000,
      enableTracing: false,
    },
    sections: [
      {
        id: 'listener',
        title: 'Listener',
        fields: [
          { id: 'listenerPort', label: 'Listener Port', type: 'number', placeholder: '10000' },
        ],
      },
      {
        id: 'cluster',
        title: 'Cluster',
        fields: [
          { id: 'clusterName', label: 'Cluster Name', type: 'text', placeholder: 'backend_cluster' },
          {
            id: 'clusterEndpoints',
            label: 'Cluster Endpoints',
            type: 'list',
            placeholder: '127.0.0.1:8080',
            defaultListItem: '127.0.0.1:8080',
          },
        ],
      },
      {
        id: 'admin',
        title: 'Admin Interface',
        fields: [
          { id: 'adminPort', label: 'Admin Port', type: 'number', placeholder: '9901' },
        ],
      },
      {
        id: 'observability',
        title: 'Observability',
        fields: [
          { id: 'enableAccessLog', label: 'Enable Access Log', type: 'toggle' },
          { id: 'enableMetrics', label: 'Enable Metrics', type: 'toggle' },
          { id: 'metricsPort', label: 'Metrics Port', type: 'number', placeholder: '9000' },
          { id: 'enableTracing', label: 'Enable Tracing', type: 'toggle' },
        ],
      },
    ],
  },
  traefik: {
    id: 'traefik',
    title: 'Traefik Reverse Proxy',
    description: 'Configure Traefik entrypoints, routers, services, and middleware',
    defaults: {
      entrypointPort: 80,
      enableDashboard: true,
      dashboardPort: 8080,
      enableACME: false,
      acmeEmail: '',
      enableKubernetes: false,
      enableDocker: true,
      defaultCertResolver: 'letsencrypt',
    },
    sections: [
      {
        id: 'entrypoint',
        title: 'Entrypoint',
        fields: [
          { id: 'entrypointPort', label: 'Entrypoint Port', type: 'number', placeholder: '80' },
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        fields: [
          { id: 'enableDashboard', label: 'Enable Dashboard', type: 'toggle' },
          { id: 'dashboardPort', label: 'Dashboard Port', type: 'number', placeholder: '8080' },
        ],
      },
      {
        id: 'providers',
        title: 'Providers',
        fields: [
          { id: 'enableDocker', label: 'Enable Docker Provider', type: 'toggle' },
          { id: 'enableKubernetes', label: 'Enable Kubernetes Provider', type: 'toggle' },
        ],
      },
      {
        id: 'certificates',
        title: 'Certificates',
        fields: [
          { id: 'enableACME', label: 'Enable ACME (Let\'s Encrypt)', type: 'toggle' },
          { id: 'acmeEmail', label: 'ACME Email', type: 'text', placeholder: 'admin@example.com' },
          { id: 'defaultCertResolver', label: 'Default Cert Resolver', type: 'text', placeholder: 'letsencrypt' },
        ],
      },
    ],
  },
};

