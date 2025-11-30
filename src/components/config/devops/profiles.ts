import { ComponentProfile } from '@/components/config/shared/types';

export const DEVOPS_PROFILES: Record<string, ComponentProfile> = {
  jenkins: {
    id: 'jenkins',
    title: 'Jenkins CI/CD',
    description: 'Configure Jenkins server, jobs, pipelines, and build agents',
    defaults: {
      serverUrl: 'http://localhost:8080',
      adminUser: 'admin',
      adminPassword: '',
      enableCSRF: true,
      executorCount: 2,
      buildTimeout: 60,
      enablePipeline: true,
      enableBlueOcean: false,
      workspacePath: '/var/jenkins_home/workspace',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:8080' },
          { id: 'adminUser', label: 'Admin Username', type: 'text', placeholder: 'admin' },
          { id: 'adminPassword', label: 'Admin Password', type: 'password', placeholder: '••••••••' },
          { id: 'workspacePath', label: 'Workspace Path', type: 'text', placeholder: '/var/jenkins_home/workspace' },
        ],
      },
      {
        id: 'execution',
        title: 'Build Execution',
        fields: [
          { id: 'executorCount', label: 'Executor Count', type: 'number', placeholder: '2' },
          { id: 'buildTimeout', label: 'Build Timeout (minutes)', type: 'number', placeholder: '60' },
          { id: 'enableCSRF', label: 'Enable CSRF Protection', type: 'toggle' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enablePipeline', label: 'Enable Pipeline Support', type: 'toggle' },
          { id: 'enableBlueOcean', label: 'Enable Blue Ocean UI', type: 'toggle' },
        ],
      },
    ],
  },
  'gitlab-ci': {
    id: 'gitlab-ci',
    title: 'GitLab CI/CD',
    description: 'Configure GitLab CI runners, pipelines, and deployment settings',
    defaults: {
      gitlabUrl: 'https://gitlab.com',
      runnerToken: '',
      concurrentJobs: 4,
      dockerImage: 'alpine:latest',
      enableDocker: true,
      enableKubernetes: false,
      cachePath: '/cache',
      artifactsPath: '/artifacts',
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'gitlabUrl', label: 'GitLab URL', type: 'text', placeholder: 'https://gitlab.com' },
          { id: 'runnerToken', label: 'Runner Token', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'execution',
        title: 'Execution',
        fields: [
          { id: 'concurrentJobs', label: 'Concurrent Jobs', type: 'number', placeholder: '4' },
          { id: 'dockerImage', label: 'Default Docker Image', type: 'text', placeholder: 'alpine:latest' },
          { id: 'enableDocker', label: 'Enable Docker Executor', type: 'toggle' },
          { id: 'enableKubernetes', label: 'Enable Kubernetes Executor', type: 'toggle' },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        fields: [
          { id: 'cachePath', label: 'Cache Path', type: 'text', placeholder: '/cache' },
          { id: 'artifactsPath', label: 'Artifacts Path', type: 'text', placeholder: '/artifacts' },
        ],
      },
    ],
  },
  'argo-cd': {
    id: 'argo-cd',
    title: 'Argo CD GitOps',
    description: 'Configure Argo CD application sync, repositories, and deployment policies',
    defaults: {
      serverUrl: 'http://localhost:8080',
      namespace: 'argocd',
      syncPolicy: 'automated',
      syncWindow: '',
      enableAutoSync: true,
      enablePrune: true,
      enableSelfHeal: false,
      repositoryUrl: '',
      targetRevision: 'HEAD',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:8080' },
          { id: 'namespace', label: 'Namespace', type: 'text', placeholder: 'argocd' },
        ],
      },
      {
        id: 'repository',
        title: 'Repository',
        fields: [
          { id: 'repositoryUrl', label: 'Repository URL', type: 'text', placeholder: 'https://github.com/user/repo' },
          { id: 'targetRevision', label: 'Target Revision', type: 'text', placeholder: 'HEAD' },
        ],
      },
      {
        id: 'sync',
        title: 'Sync Policy',
        fields: [
          {
            id: 'syncPolicy',
            label: 'Sync Policy',
            type: 'select',
            options: [
              { value: 'manual', label: 'Manual' },
              { value: 'automated', label: 'Automated' },
            ],
          },
          { id: 'enableAutoSync', label: 'Enable Auto-Sync', type: 'toggle' },
          { id: 'enablePrune', label: 'Enable Prune', type: 'toggle' },
          { id: 'enableSelfHeal', label: 'Enable Self-Heal', type: 'toggle' },
          { id: 'syncWindow', label: 'Sync Window', type: 'text', placeholder: '09:00-17:00' },
        ],
      },
    ],
  },
  terraform: {
    id: 'terraform',
    title: 'Terraform Infrastructure',
    description: 'Configure Terraform state, providers, and workspace settings',
    defaults: {
      stateBackend: 'local',
      statePath: './terraform.tfstate',
      remoteBackendUrl: '',
      workspace: 'default',
      enableLocking: true,
      enableVersioning: false,
      terraformVersion: '1.5.0',
    },
    sections: [
      {
        id: 'state',
        title: 'State Management',
        fields: [
          {
            id: 'stateBackend',
            label: 'State Backend',
            type: 'select',
            options: [
              { value: 'local', label: 'Local' },
              { value: 's3', label: 'S3' },
              { value: 'gcs', label: 'GCS' },
              { value: 'azure', label: 'Azure Storage' },
            ],
          },
          { id: 'statePath', label: 'State Path', type: 'text', placeholder: './terraform.tfstate' },
          { id: 'remoteBackendUrl', label: 'Remote Backend URL', type: 'text', placeholder: '' },
        ],
      },
      {
        id: 'workspace',
        title: 'Workspace',
        fields: [
          { id: 'workspace', label: 'Workspace Name', type: 'text', placeholder: 'default' },
          { id: 'terraformVersion', label: 'Terraform Version', type: 'text', placeholder: '1.5.0' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enableLocking', label: 'Enable State Locking', type: 'toggle' },
          { id: 'enableVersioning', label: 'Enable Versioning', type: 'toggle' },
        ],
      },
    ],
  },
  ansible: {
    id: 'ansible',
    title: 'Ansible Automation',
    description: 'Configure Ansible inventory, playbooks, and execution settings',
    defaults: {
      inventoryPath: './inventory',
      playbookPath: './playbooks',
      becomeMethod: 'sudo',
      hostKeyChecking: false,
      forks: 5,
      timeout: 30,
      enableVault: false,
      vaultPassword: '',
    },
    sections: [
      {
        id: 'paths',
        title: 'Paths',
        fields: [
          { id: 'inventoryPath', label: 'Inventory Path', type: 'text', placeholder: './inventory' },
          { id: 'playbookPath', label: 'Playbook Path', type: 'text', placeholder: './playbooks' },
        ],
      },
      {
        id: 'execution',
        title: 'Execution',
        fields: [
          {
            id: 'becomeMethod',
            label: 'Become Method',
            type: 'select',
            options: [
              { value: 'sudo', label: 'sudo' },
              { value: 'su', label: 'su' },
              { value: 'pbrun', label: 'pbrun' },
            ],
          },
          { id: 'forks', label: 'Forks (parallel hosts)', type: 'number', placeholder: '5' },
          { id: 'timeout', label: 'Timeout (seconds)', type: 'number', placeholder: '30' },
          { id: 'hostKeyChecking', label: 'Host Key Checking', type: 'toggle' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableVault', label: 'Enable Ansible Vault', type: 'toggle' },
          { id: 'vaultPassword', label: 'Vault Password', type: 'password', placeholder: '••••••••' },
        ],
      },
    ],
  },
  harbor: {
    id: 'harbor',
    title: 'Harbor Container Registry',
    description: 'Configure Harbor registry, projects, replication, and security settings',
    defaults: {
      serverUrl: 'http://localhost:8080',
      adminUser: 'admin',
      adminPassword: '',
      projectName: 'library',
      enableVulnerabilityScanning: true,
      enableContentTrust: false,
      enableReplication: false,
      replicationEndpoint: '',
      storageQuota: 0,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:8080' },
          { id: 'adminUser', label: 'Admin Username', type: 'text', placeholder: 'admin' },
          { id: 'adminPassword', label: 'Admin Password', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'project',
        title: 'Project Settings',
        fields: [
          { id: 'projectName', label: 'Project Name', type: 'text', placeholder: 'library' },
          { id: 'storageQuota', label: 'Storage Quota (GB, 0 = unlimited)', type: 'number', placeholder: '0' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableVulnerabilityScanning', label: 'Enable Vulnerability Scanning', type: 'toggle' },
          { id: 'enableContentTrust', label: 'Enable Content Trust', type: 'toggle' },
        ],
      },
      {
        id: 'replication',
        title: 'Replication',
        fields: [
          { id: 'enableReplication', label: 'Enable Replication', type: 'toggle' },
          { id: 'replicationEndpoint', label: 'Replication Endpoint', type: 'text', placeholder: 'https://remote-harbor:8080' },
        ],
      },
    ],
  },
};

