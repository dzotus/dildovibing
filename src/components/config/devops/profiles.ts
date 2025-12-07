import { ComponentProfile } from '../shared/types';

export const DEVOPS_PROFILES: Record<string, ComponentProfile> = {
  jenkins: {
    id: 'jenkins',
    title: 'Jenkins',
    description: 'Open-source automation server for CI/CD pipelines.',
    badge: 'CI/CD',
    docsUrl: 'https://www.jenkins.io/',
    defaults: {
      jenkinsUrl: 'http://jenkins:8080',
      enableCSRF: true,
      executorCount: 2,
      enablePlugins: true,
      plugins: ['git', 'docker', 'kubernetes'],
      enablePipeline: true,
      enableBlueOcean: false,
      enableArtifactArchiving: true,
      retentionDays: 30,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          {
            id: 'jenkinsUrl',
            label: 'Jenkins URL',
            type: 'text',
            placeholder: 'http://jenkins:8080',
          },
          {
            id: 'enableCSRF',
            label: 'Enable CSRF Protection',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'executors',
        title: 'Executors',
        fields: [
          {
            id: 'executorCount',
            label: 'Executor Count',
            type: 'number',
            min: 1,
            max: 100,
            description: 'Number of concurrent builds',
          },
        ],
      },
      {
        id: 'plugins',
        title: 'Plugins',
        fields: [
          {
            id: 'enablePlugins',
            label: 'Enable Plugins',
            type: 'toggle',
          },
          {
            id: 'plugins',
            label: 'Installed Plugins',
            type: 'list',
            description: 'List of plugin names',
            defaultListItem: 'git',
          },
        ],
      },
      {
        id: 'pipelines',
        title: 'Pipelines',
        fields: [
          {
            id: 'enablePipeline',
            label: 'Enable Pipelines',
            type: 'toggle',
          },
          {
            id: 'enableBlueOcean',
            label: 'Enable Blue Ocean',
            type: 'toggle',
            description: 'Modern pipeline UI',
          },
        ],
      },
      {
        id: 'artifacts',
        title: 'Artifact Management',
        fields: [
          {
            id: 'enableArtifactArchiving',
            label: 'Enable Artifact Archiving',
            type: 'toggle',
          },
          {
            id: 'retentionDays',
            label: 'Retention Days',
            type: 'number',
            min: 1,
            max: 365,
            suffix: 'days',
            description: 'How long to keep artifacts',
          },
        ],
      },
    ],
  },
  'gitlab-ci': {
    id: 'gitlab-ci',
    title: 'GitLab CI/CD',
    description: 'Built-in continuous integration and deployment for GitLab.',
    badge: 'CI/CD',
    docsUrl: 'https://docs.gitlab.com/ee/ci/',
    defaults: {
      gitlabUrl: 'https://gitlab.com',
      enableRunners: true,
      runnerType: 'docker',
      concurrentJobs: 4,
      enableCache: true,
      cacheType: 's3',
      enableArtifacts: true,
      artifactsExpiry: '7d',
      enableKubernetes: false,
      k8sNamespace: 'gitlab-runner',
    },
    sections: [
      {
        id: 'gitlab',
        title: 'GitLab Configuration',
        fields: [
          {
            id: 'gitlabUrl',
            label: 'GitLab URL',
            type: 'text',
            placeholder: 'https://gitlab.com',
          },
        ],
      },
      {
        id: 'runners',
        title: 'Runners',
        fields: [
          {
            id: 'enableRunners',
            label: 'Enable Runners',
            type: 'toggle',
          },
          {
            id: 'runnerType',
            label: 'Runner Type',
            type: 'select',
            options: [
              { label: 'Docker', value: 'docker' },
              { label: 'Kubernetes', value: 'kubernetes' },
              { label: 'Shell', value: 'shell' },
            ],
          },
          {
            id: 'concurrentJobs',
            label: 'Concurrent Jobs',
            type: 'number',
            min: 1,
            max: 100,
            description: 'Number of concurrent jobs per runner',
          },
        ],
      },
      {
        id: 'cache',
        title: 'Cache',
        fields: [
          {
            id: 'enableCache',
            label: 'Enable Cache',
            type: 'toggle',
          },
          {
            id: 'cacheType',
            label: 'Cache Type',
            type: 'select',
            options: [
              { label: 'S3', value: 's3' },
              { label: 'GCS', value: 'gcs' },
              { label: 'Local', value: 'local' },
            ],
          },
        ],
      },
      {
        id: 'artifacts',
        title: 'Artifacts',
        fields: [
          {
            id: 'enableArtifacts',
            label: 'Enable Artifacts',
            type: 'toggle',
          },
          {
            id: 'artifactsExpiry',
            label: 'Artifacts Expiry',
            type: 'text',
            placeholder: '7d',
            description: 'How long to keep artifacts (e.g., 7d, 30d)',
          },
        ],
      },
      {
        id: 'kubernetes',
        title: 'Kubernetes Integration',
        fields: [
          {
            id: 'enableKubernetes',
            label: 'Enable Kubernetes',
            type: 'toggle',
          },
          {
            id: 'k8sNamespace',
            label: 'Kubernetes Namespace',
            type: 'text',
            placeholder: 'gitlab-runner',
          },
        ],
      },
    ],
  },
  'argo-cd': {
    id: 'argo-cd',
    title: 'Argo CD',
    description: 'Declarative GitOps continuous delivery tool for Kubernetes.',
    badge: 'GitOps',
    docsUrl: 'https://argo-cd.readthedocs.io/',
    defaults: {
      argoUrl: 'http://argocd:8080',
      enableSSO: false,
      ssoProvider: 'oidc',
      enableRBAC: true,
      enableSyncPolicy: true,
      autoSync: false,
      syncPolicy: 'automated',
      enableHealthChecks: true,
      enableNotifications: true,
      notificationChannels: ['slack'],
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          {
            id: 'argoUrl',
            label: 'Argo CD URL',
            type: 'text',
            placeholder: 'http://argocd:8080',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Authentication',
        fields: [
          {
            id: 'enableSSO',
            label: 'Enable SSO',
            type: 'toggle',
          },
          {
            id: 'ssoProvider',
            label: 'SSO Provider',
            type: 'select',
            options: [
              { label: 'OIDC', value: 'oidc' },
              { label: 'SAML', value: 'saml' },
              { label: 'LDAP', value: 'ldap' },
            ],
          },
          {
            id: 'enableRBAC',
            label: 'Enable RBAC',
            type: 'toggle',
            description: 'Role-based access control',
          },
        ],
      },
      {
        id: 'sync',
        title: 'Sync Policy',
        fields: [
          {
            id: 'enableSyncPolicy',
            label: 'Enable Sync Policy',
            type: 'toggle',
          },
          {
            id: 'autoSync',
            label: 'Auto Sync',
            type: 'toggle',
            description: 'Automatically sync applications',
          },
          {
            id: 'syncPolicy',
            label: 'Sync Policy',
            type: 'select',
            options: [
              { label: 'Automated', value: 'automated' },
              { label: 'Manual', value: 'manual' },
              { label: 'Sync Window', value: 'sync-window' },
            ],
          },
        ],
      },
      {
        id: 'health',
        title: 'Health Checks & Notifications',
        fields: [
          {
            id: 'enableHealthChecks',
            label: 'Enable Health Checks',
            type: 'toggle',
          },
          {
            id: 'enableNotifications',
            label: 'Enable Notifications',
            type: 'toggle',
          },
          {
            id: 'notificationChannels',
            label: 'Notification Channels',
            type: 'list',
            description: 'Channels for sync notifications',
            defaultListItem: 'slack',
          },
        ],
      },
    ],
  },
  terraform: {
    id: 'terraform',
    title: 'Terraform',
    description: 'Infrastructure as Code tool for provisioning and managing cloud resources.',
    badge: 'IaC',
    docsUrl: 'https://www.terraform.io/',
    defaults: {
      terraformVersion: '1.5.0',
      backendType: 's3',
      backendConfig: '',
      enableStateLocking: true,
      stateLockBackend: 'dynamodb',
      enableWorkspaces: true,
      workspaceName: 'default',
      enableRemoteState: true,
      enablePlan: true,
      enableApply: false,
    },
    sections: [
      {
        id: 'version',
        title: 'Terraform Version',
        fields: [
          {
            id: 'terraformVersion',
            label: 'Version',
            type: 'text',
            placeholder: '1.5.0',
          },
        ],
      },
      {
        id: 'backend',
        title: 'Backend Configuration',
        fields: [
          {
            id: 'backendType',
            label: 'Backend Type',
            type: 'select',
            options: [
              { label: 'S3', value: 's3' },
              { label: 'Azure', value: 'azurerm' },
              { label: 'GCS', value: 'gcs' },
              { label: 'Local', value: 'local' },
            ],
          },
          {
            id: 'backendConfig',
            label: 'Backend Config',
            type: 'textarea',
            placeholder: 'bucket = "terraform-state"\nkey = "app/terraform.tfstate"',
            description: 'Backend configuration (HCL format)',
          },
        ],
      },
      {
        id: 'state',
        title: 'State Management',
        fields: [
          {
            id: 'enableStateLocking',
            label: 'Enable State Locking',
            type: 'toggle',
            description: 'Prevent concurrent modifications',
          },
          {
            id: 'stateLockBackend',
            label: 'State Lock Backend',
            type: 'select',
            options: [
              { label: 'DynamoDB', value: 'dynamodb' },
              { label: 'Consul', value: 'consul' },
              { label: 'etcd', value: 'etcd' },
            ],
          },
        ],
      },
      {
        id: 'workspaces',
        title: 'Workspaces',
        fields: [
          {
            id: 'enableWorkspaces',
            label: 'Enable Workspaces',
            type: 'toggle',
            description: 'Isolate state per environment',
          },
          {
            id: 'workspaceName',
            label: 'Workspace Name',
            type: 'text',
            placeholder: 'default',
          },
        ],
      },
      {
        id: 'operations',
        title: 'Operations',
        fields: [
          {
            id: 'enablePlan',
            label: 'Enable Plan',
            type: 'toggle',
            description: 'Show execution plan before apply',
          },
          {
            id: 'enableApply',
            label: 'Enable Auto Apply',
            type: 'toggle',
            description: 'Automatically apply changes',
          },
        ],
      },
    ],
  },
  ansible: {
    id: 'ansible',
    title: 'Ansible',
    description: 'Automation platform for configuration management and application deployment.',
    badge: 'Automation',
    docsUrl: 'https://www.ansible.com/',
    defaults: {
      ansibleVersion: '2.15',
      inventoryType: 'static',
      inventoryFile: '/etc/ansible/hosts',
      enableVault: true,
      vaultPasswordFile: '',
      enableRoles: true,
      rolesPath: '/etc/ansible/roles',
      enablePlaybooks: true,
      enableGalaxy: true,
      galaxyRoles: [],
    },
    sections: [
      {
        id: 'version',
        title: 'Ansible Version',
        fields: [
          {
            id: 'ansibleVersion',
            label: 'Version',
            type: 'text',
            placeholder: '2.15',
          },
        ],
      },
      {
        id: 'inventory',
        title: 'Inventory',
        fields: [
          {
            id: 'inventoryType',
            label: 'Inventory Type',
            type: 'select',
            options: [
              { label: 'Static', value: 'static' },
              { label: 'Dynamic', value: 'dynamic' },
              { label: 'Cloud', value: 'cloud' },
            ],
          },
          {
            id: 'inventoryFile',
            label: 'Inventory File',
            type: 'text',
            placeholder: '/etc/ansible/hosts',
          },
        ],
      },
      {
        id: 'vault',
        title: 'Vault',
        fields: [
          {
            id: 'enableVault',
            label: 'Enable Vault',
            type: 'toggle',
            description: 'Encrypt sensitive data',
          },
          {
            id: 'vaultPasswordFile',
            label: 'Vault Password File',
            type: 'text',
            placeholder: '/path/to/vault-password',
          },
        ],
      },
      {
        id: 'roles',
        title: 'Roles & Playbooks',
        fields: [
          {
            id: 'enableRoles',
            label: 'Enable Roles',
            type: 'toggle',
          },
          {
            id: 'rolesPath',
            label: 'Roles Path',
            type: 'text',
            placeholder: '/etc/ansible/roles',
          },
          {
            id: 'enablePlaybooks',
            label: 'Enable Playbooks',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'galaxy',
        title: 'Ansible Galaxy',
        fields: [
          {
            id: 'enableGalaxy',
            label: 'Enable Galaxy',
            type: 'toggle',
            description: 'Use Ansible Galaxy roles',
          },
          {
            id: 'galaxyRoles',
            label: 'Galaxy Roles',
            type: 'list',
            description: 'List of Galaxy role names',
            defaultListItem: 'geerlingguy.docker',
          },
        ],
      },
    ],
  },
  harbor: {
    id: 'harbor',
    title: 'Harbor Registry',
    description: 'Cloud-native container registry with vulnerability scanning and replication.',
    badge: 'Container Registry',
    docsUrl: 'https://goharbor.io/',
    defaults: {
      harborUrl: 'https://harbor.example.com',
      enableSSL: true,
      enableAuth: true,
      authMode: 'db_auth',
      enableScanning: true,
      scannerType: 'trivy',
      enableReplication: false,
      replicationEndpoints: [],
      enableGarbageCollection: true,
      gcSchedule: '0 0 2 * * *',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          {
            id: 'harborUrl',
            label: 'Harbor URL',
            type: 'text',
            placeholder: 'https://harbor.example.com',
          },
          {
            id: 'enableSSL',
            label: 'Enable SSL',
            type: 'toggle',
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
            id: 'authMode',
            label: 'Auth Mode',
            type: 'select',
            options: [
              { label: 'Database', value: 'db_auth' },
              { label: 'LDAP', value: 'ldap_auth' },
              { label: 'OIDC', value: 'oidc_auth' },
            ],
          },
        ],
      },
      {
        id: 'scanning',
        title: 'Vulnerability Scanning',
        fields: [
          {
            id: 'enableScanning',
            label: 'Enable Scanning',
            type: 'toggle',
            description: 'Scan images for vulnerabilities',
          },
          {
            id: 'scannerType',
            label: 'Scanner Type',
            type: 'select',
            options: [
              { label: 'Trivy', value: 'trivy' },
              { label: 'Clair', value: 'clair' },
            ],
          },
        ],
      },
      {
        id: 'replication',
        title: 'Replication',
        fields: [
          {
            id: 'enableReplication',
            label: 'Enable Replication',
            type: 'toggle',
            description: 'Replicate images to remote registries',
          },
          {
            id: 'replicationEndpoints',
            label: 'Replication Endpoints',
            type: 'list',
            description: 'Remote registry endpoints',
            defaultListItem: 'https://remote-registry.com',
          },
        ],
      },
      {
        id: 'maintenance',
        title: 'Maintenance',
        fields: [
          {
            id: 'enableGarbageCollection',
            label: 'Enable Garbage Collection',
            type: 'toggle',
            description: 'Clean up unused blobs',
          },
          {
            id: 'gcSchedule',
            label: 'GC Schedule',
            type: 'text',
            placeholder: '0 0 2 * * *',
            description: 'Cron expression for GC schedule',
          },
        ],
      },
    ],
  },
};

