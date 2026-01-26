/**
 * Метаданные плагинов Jenkins
 * Расширяемый список популярных плагинов с версиями, описаниями и зависимостями
 */

export interface PluginMetadata {
  name: string;
  latestVersion: string;
  description: string;
  dependencies?: string[];
  category: 'scm' | 'build' | 'deploy' | 'ui' | 'security' | 'notification' | 'integration' | 'other';
}

/**
 * Метаданные популярных плагинов Jenkins
 */
export const JENKINS_PLUGINS: Record<string, PluginMetadata> = {
  // SCM плагины
  'git': {
    name: 'Git',
    latestVersion: '4.11.0',
    description: 'Git integration plugin',
    category: 'scm',
  },
  'gitlab-plugin': {
    name: 'GitLab Plugin',
    latestVersion: '1.7.0',
    description: 'GitLab integration plugin',
    category: 'scm',
  },
  'subversion': {
    name: 'Subversion',
    latestVersion: '2.16.0',
    description: 'Subversion integration plugin',
    category: 'scm',
  },
  'mercurial': {
    name: 'Mercurial',
    latestVersion: '2.10',
    description: 'Mercurial integration plugin',
    category: 'scm',
  },
  'bitbucket': {
    name: 'Bitbucket',
    latestVersion: '1.1.25',
    description: 'Bitbucket integration plugin',
    category: 'scm',
  },
  
  // Build плагины
  'maven-plugin': {
    name: 'Maven Integration',
    latestVersion: '3.20',
    description: 'Maven integration plugin',
    category: 'build',
  },
  'gradle': {
    name: 'Gradle',
    latestVersion: '1.36.1',
    description: 'Gradle plugin',
    category: 'build',
  },
  'ant': {
    name: 'Ant',
    latestVersion: '1.13',
    description: 'Apache Ant plugin',
    category: 'build',
  },
  'nodejs': {
    name: 'NodeJS',
    latestVersion: '1.5.1',
    description: 'NodeJS integration plugin',
    category: 'build',
  },
  'python': {
    name: 'Python',
    latestVersion: '1.3',
    description: 'Python integration plugin',
    category: 'build',
  },
  
  // Deploy плагины
  'docker': {
    name: 'Docker Pipeline',
    latestVersion: '1.2.9',
    description: 'Docker pipeline plugin',
    dependencies: ['workflow-aggregator'],
    category: 'deploy',
  },
  'kubernetes': {
    name: 'Kubernetes',
    latestVersion: '1.31.1',
    description: 'Kubernetes plugin for dynamic agent provisioning',
    category: 'deploy',
  },
  'ansible': {
    name: 'Ansible',
    latestVersion: '1.1',
    description: 'Ansible integration plugin',
    category: 'deploy',
  },
  'ssh': {
    name: 'SSH',
    latestVersion: '2.10.1',
    description: 'SSH deployment plugin',
    category: 'deploy',
  },
  
  // UI плагины
  'blue-ocean': {
    name: 'Blue Ocean',
    latestVersion: '1.25.3',
    description: 'Blue Ocean UI for Jenkins',
    dependencies: ['workflow-aggregator'],
    category: 'ui',
  },
  'workflow-aggregator': {
    name: 'Pipeline',
    latestVersion: '2.6',
    description: 'Pipeline plugin aggregator',
    category: 'ui',
  },
  'dashboard-view': {
    name: 'Dashboard View',
    latestVersion: '2.17',
    description: 'Dashboard view plugin',
    category: 'ui',
  },
  
  // Security плагины
  'credentials': {
    name: 'Credentials Binding',
    latestVersion: '2.6.1',
    description: 'Credentials management plugin',
    category: 'security',
  },
  'role-strategy': {
    name: 'Role-based Authorization',
    latestVersion: '3.1.1',
    description: 'Role-based authorization strategy',
    category: 'security',
  },
  'oauth': {
    name: 'OAuth',
    latestVersion: '2.4',
    description: 'OAuth authentication plugin',
    category: 'security',
  },
  
  // Notification плагины
  'email-ext': {
    name: 'Email Extension',
    latestVersion: '2.93',
    description: 'Extended email notification plugin',
    category: 'notification',
  },
  'slack': {
    name: 'Slack Notification',
    latestVersion: '2.49',
    description: 'Slack notification plugin',
    category: 'notification',
  },
  'telegram-notifications': {
    name: 'Telegram Notifications',
    latestVersion: '1.4.0',
    description: 'Telegram notification plugin',
    category: 'notification',
  },
  'hipchat': {
    name: 'HipChat',
    latestVersion: '1.4.0',
    description: 'HipChat notification plugin',
    category: 'notification',
  },
  
  // Integration плагины
  'jira': {
    name: 'JIRA',
    latestVersion: '3.7.0',
    description: 'JIRA integration plugin',
    category: 'integration',
  },
  'confluence-publisher': {
    name: 'Confluence Publisher',
    latestVersion: '2.0.9',
    description: 'Confluence publisher plugin',
    category: 'integration',
  },
  'sonar': {
    name: 'SonarQube Scanner',
    latestVersion: '2.13',
    description: 'SonarQube scanner plugin',
    category: 'integration',
  },
  'artifactory': {
    name: 'Artifactory',
    latestVersion: '3.15.0',
    description: 'Artifactory integration plugin',
    category: 'integration',
  },
  
  // Testing плагины
  'junit': {
    name: 'JUnit',
    latestVersion: '1.53',
    description: 'JUnit test result publisher',
    category: 'other',
  },
  'testng': {
    name: 'TestNG Results',
    latestVersion: '1.19',
    description: 'TestNG results publisher',
    category: 'other',
  },
  'cobertura': {
    name: 'Cobertura',
    latestVersion: '1.17',
    description: 'Code coverage plugin',
    category: 'other',
  },
  'jacoco': {
    name: 'JaCoCo',
    latestVersion: '3.3.2',
    description: 'JaCoCo code coverage plugin',
    category: 'other',
  },
  
  // Other плагины
  'ssh-slaves': {
    name: 'SSH Slaves',
    latestVersion: '1.32.0',
    description: 'SSH agent plugin',
    category: 'other',
  },
  'timestamper': {
    name: 'Timestamper',
    latestVersion: '1.18',
    description: 'Add timestamps to console output',
    category: 'other',
  },
  'build-timeout': {
    name: 'Build Timeout',
    latestVersion: '1.24',
    description: 'Build timeout plugin',
    category: 'other',
  },
  'warnings': {
    name: 'Warnings',
    latestVersion: '5.1.1',
    description: 'Compiler warnings plugin',
    category: 'other',
  },
  'htmlpublisher': {
    name: 'HTML Publisher',
    latestVersion: '1.30',
    description: 'HTML report publisher',
    category: 'other',
  },
  'archive-artifacts': {
    name: 'Archive Artifacts',
    latestVersion: '1.7',
    description: 'Archive artifacts plugin',
    category: 'other',
  },
  'copyartifact': {
    name: 'Copy Artifact',
    latestVersion: '1.46.1',
    description: 'Copy artifacts from other projects',
    category: 'other',
  },
  'parameterized-trigger': {
    name: 'Parameterized Trigger',
    latestVersion: '2.43',
    description: 'Trigger builds with parameters',
    category: 'other',
  },
  'build-pipeline-plugin': {
    name: 'Build Pipeline',
    latestVersion: '1.5.13',
    description: 'Build pipeline view plugin',
    category: 'other',
  },
  'promoted-builds': {
    name: 'Promoted Builds',
    latestVersion: '3.10',
    description: 'Promoted builds plugin',
    category: 'other',
  },
};

/**
 * Получает метаданные плагина по имени
 */
export function getPluginMetadata(pluginName: string): PluginMetadata | undefined {
  return JENKINS_PLUGINS[pluginName];
}

/**
 * Получает все плагины по категории
 */
export function getPluginsByCategory(category: PluginMetadata['category']): PluginMetadata[] {
  return Object.values(JENKINS_PLUGINS).filter(p => p.category === category);
}

/**
 * Получает все плагины
 */
export function getAllPlugins(): PluginMetadata[] {
  return Object.values(JENKINS_PLUGINS);
}
