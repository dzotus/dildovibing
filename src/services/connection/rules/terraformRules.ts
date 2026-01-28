import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { logError } from '@/utils/logger';

/**
 * Правило для подключения VCS к Terraform (GitLab CI, GitHub, Webhook → Terraform)
 * Автоматически настраивает workspace.vcsRepo при создании соединения
 */
export function createTerraformVCSRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: ['gitlab-ci', 'github', 'webhook'],
    targetTypes: ['terraform'],
    priority: 10,
    
    updateTargetConfig: (source, target, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const targetConfig = target.data.config || {};
      const workspaces = Array.isArray(targetConfig.workspaces) ? targetConfig.workspaces : [];
      
      // Получаем VCS repo из источника
      const sourceConfig = source.data.config || {};
      let vcsRepo: { identifier: string; branch: string; oauthTokenId?: string } | undefined;
      
      if (source.type === 'gitlab-ci') {
        const repo = sourceConfig.repository || sourceConfig.repo || source.data.label || 'unknown/repo';
        const branch = sourceConfig.branch || sourceConfig.defaultBranch || 'main';
        vcsRepo = {
          identifier: repo,
          branch: branch,
        };
      } else if (source.type === 'github') {
        const repo = sourceConfig.repository || sourceConfig.repo || source.data.label || 'unknown/repo';
        const branch = sourceConfig.branch || sourceConfig.defaultBranch || 'main';
        vcsRepo = {
          identifier: repo,
          branch: branch,
        };
      } else if (source.type === 'webhook') {
        const repo = sourceConfig.repository || sourceConfig.repo || source.data.label || 'unknown/repo';
        const branch = sourceConfig.branch || sourceConfig.defaultBranch || 'main';
        vcsRepo = {
          identifier: repo,
          branch: branch,
        };
      }
      
      if (!vcsRepo) {
        return null;
      }
      
      // Находим или создаем workspace для этого VCS
      const sourceLabel = source.data.label || source.type;
      let workspace = workspaces.find((w: any) => 
        w.vcsRepo?.identifier === vcsRepo.identifier && w.vcsRepo?.branch === vcsRepo.branch
      );
      
      if (!workspace) {
        // Создаем новый workspace для этого VCS
        // Добавляем пример HCL кода для демонстрации
        const exampleHCLCode = `# Example HCL code from ${sourceLabel}
# This code will be automatically updated when VCS sends webhook

resource "kubernetes_deployment" "example" {
  metadata {
    name = "example-deployment"
    namespace = "default"
  }
  
  spec {
    replicas = 3
    
    selector {
      match_labels = {
        app = "example"
      }
    }
    
    template {
      metadata {
        labels = {
          app = "example"
        }
      }
      
      spec {
        container {
          name  = "example"
          image = "nginx:latest"
          
          port {
            container_port = 80
          }
          
          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "example" {
  metadata {
    name = "example-service"
    namespace = "default"
  }
  
  spec {
    selector = {
      app = "example"
    }
    
    port {
      port        = 80
      target_port = 80
    }
    
    type = "ClusterIP"
  }
}`;
        
        workspace = {
          id: `workspace-${source.id}-${Date.now()}`,
          name: `${sourceLabel}-workspace`,
          description: `Workspace for ${sourceLabel} VCS integration`,
          terraformVersion: targetConfig.defaultTerraformVersion || '1.5.0',
          autoApply: false,
          queueAllRuns: true,
          vcsRepo: vcsRepo,
          hclCode: exampleHCLCode,
          hclCodeVersion: 'example',
          hclCodeUpdatedAt: Date.now(),
        };
        workspaces.push(workspace);
      } else {
        // Обновляем существующий workspace
        workspace.vcsRepo = vcsRepo;
        // Если у workspace еще нет HCL кода, добавляем пример
        if (!workspace.hclCode) {
          const exampleHCLCode = `# Example HCL code from ${sourceLabel}
resource "kubernetes_deployment" "example" {
  metadata {
    name = "example-deployment"
  }
  spec {
    replicas = 3
    selector {
      match_labels = {
        app = "example"
      }
    }
    template {
      metadata {
        labels = {
          app = "example"
        }
      }
      spec {
        container {
          name  = "example"
          image = "nginx:latest"
        }
      }
    }
  }
}`;
          workspace.hclCode = exampleHCLCode;
          workspace.hclCodeVersion = 'example';
          workspace.hclCodeUpdatedAt = Date.now();
        }
      }
      
      return { workspaces };
    },
    
    cleanupTargetConfig: (source, target, connection, metadata) => {
      if (!target?.data) return null;
      
      const targetConfig = target.data.config || {};
      const workspaces = Array.isArray(targetConfig.workspaces) ? targetConfig.workspaces : [];
      
      // Удаляем VCS repo из workspace при удалении соединения
      const sourceConfig = source.data.config || {};
      const repo = sourceConfig.repository || sourceConfig.repo;
      
      if (repo) {
        const updatedWorkspaces = workspaces.map((w: any) => {
          if (w.vcsRepo?.identifier === repo) {
            const { vcsRepo, ...rest } = w;
            return rest;
          }
          return w;
        });
        
        return { workspaces: updatedWorkspaces };
      }
      
      return null;
    },
  };
}

/**
 * Правило для подключения Terraform к Kubernetes/Docker
 * Автоматически настраивает notification destination в Terraform workspace
 */
export function createTerraformKubernetesRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: ['terraform'],
    targetTypes: ['kubernetes', 'docker'],
    priority: 10,
    
    updateSourceConfig: (source, target, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      
      // Получаем или создаем notifications массив для каждого workspace
      const targetLabel = target.data.label || target.type;
      const targetId = target.id;
      
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        
        // Проверяем, есть ли уже notification для этого компонента
        const existingNotification = notifications.find((n: any) => 
          n.type === 'component' && n.destination === targetId
        );
        
        if (!existingNotification) {
          // Добавляем новую notification configuration
          notifications.push({
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: ['on_success', 'on_failure'],
            enabled: true,
          });
        }
        
        return {
          ...w,
          notifications,
        };
      });
      
      // Если нет workspaces, создаем дефолтный
      if (updatedWorkspaces.length === 0) {
        updatedWorkspaces.push({
          id: 'default',
          name: 'production',
          description: 'Production infrastructure',
          terraformVersion: sourceConfig.defaultTerraformVersion || '1.5.0',
          autoApply: false,
          queueAllRuns: true,
          notifications: [{
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: ['on_success', 'on_failure'],
            enabled: true,
          }],
        });
      }
      
      return { workspaces: updatedWorkspaces };
    },
    
    cleanupSourceConfig: (source, target, connection, metadata) => {
      if (!source?.data) return null;
      
      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      const targetId = target.id;
      
      // Удаляем notification для этого компонента
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        const filteredNotifications = notifications.filter((n: any) => 
          !(n.type === 'component' && n.destination === targetId)
        );
        
        return {
          ...w,
          notifications: filteredNotifications,
        };
      });
      
      return { workspaces: updatedWorkspaces };
    },
  };
}

/**
 * Правило для подключения Terraform к Argo CD
 * Автоматически настраивает notification destination в Terraform workspace
 */
export function createTerraformArgoCDRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: ['terraform'],
    targetTypes: ['argo-cd'],
    priority: 10,
    
    updateSourceConfig: (source, target, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      
      // Получаем или создаем notifications массив для каждого workspace
      const targetLabel = target.data.label || target.type;
      const targetId = target.id;
      
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        
        // Проверяем, есть ли уже notification для этого компонента
        const existingNotification = notifications.find((n: any) => 
          n.type === 'component' && n.destination === targetId
        );
        
        if (!existingNotification) {
          // Добавляем новую notification configuration
          notifications.push({
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: ['on_success'],
            enabled: true,
          });
        }
        
        return {
          ...w,
          notifications,
        };
      });
      
      // Если нет workspaces, создаем дефолтный
      if (updatedWorkspaces.length === 0) {
        updatedWorkspaces.push({
          id: 'default',
          name: 'production',
          description: 'Production infrastructure',
          terraformVersion: sourceConfig.defaultTerraformVersion || '1.5.0',
          autoApply: false,
          queueAllRuns: true,
          notifications: [{
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: ['on_success'],
            enabled: true,
          }],
        });
      }
      
      return { workspaces: updatedWorkspaces };
    },
    
    cleanupSourceConfig: (source, target, connection, metadata) => {
      if (!source?.data) return null;
      
      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      const targetId = target.id;
      
      // Удаляем notification для этого компонента
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        const filteredNotifications = notifications.filter((n: any) => 
          !(n.type === 'component' && n.destination === targetId)
        );
        
        return {
          ...w,
          notifications: filteredNotifications,
        };
      });
      
      return { workspaces: updatedWorkspaces };
    },
  };
}

/**
 * Правило для подключения Vault к Terraform (Secrets Management)
 * Автоматически настраивает Vault backend в Terraform workspace
 */
export function createTerraformVaultRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: ['secrets-vault'],
    targetTypes: ['terraform'],
    priority: 10,
    
    updateTargetConfig: (source, target, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const targetConfig = target.data.config || {};
      const workspaces = Array.isArray(targetConfig.workspaces) ? targetConfig.workspaces : [];
      
      // Получаем адрес Vault из конфигурации или metadata
      const vaultConfig = source.data.config || {};
      const protocol = vaultConfig.enableTLS ? 'https' : 'http';
      const vaultAddress = vaultConfig.address || `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Обновляем все workspaces с Vault backend
      const updatedWorkspaces = workspaces.map((w: any) => {
        // Добавляем Vault backend configuration
        const vaultBackend = {
          address: vaultAddress,
          path: `terraform/${w.id || w.name || 'default'}`,
          token: vaultConfig.token || '', // В реальности токен должен быть в secrets
        };
        
        return {
          ...w,
          vaultBackend,
        };
      });
      
      // Если нет workspaces, создаем дефолтный с Vault backend
      if (updatedWorkspaces.length === 0) {
        updatedWorkspaces.push({
          id: 'default',
          name: 'production',
          description: 'Production infrastructure',
          terraformVersion: targetConfig.defaultTerraformVersion || '1.5.0',
          autoApply: false,
          queueAllRuns: true,
          vaultBackend: {
            address: vaultAddress,
            path: 'terraform/default',
            token: vaultConfig.token || '',
          },
        });
      }
      
      return { workspaces: updatedWorkspaces };
    },
    
    cleanupTargetConfig: (source, target, connection, metadata) => {
      if (!target?.data) return null;
      
      const targetConfig = target.data.config || {};
      const workspaces = Array.isArray(targetConfig.workspaces) ? targetConfig.workspaces : [];
      
      // Удаляем Vault backend из workspaces
      const updatedWorkspaces = workspaces.map((w: any) => {
        const { vaultBackend, ...rest } = w;
        return rest;
      });
      
      return { workspaces: updatedWorkspaces };
    },
  };
}

/**
 * Правило для подключения Terraform к Observability компонентам (Prometheus, Grafana, Loki, Jaeger, OpenTelemetry)
 * Автоматически настраивает notification destination в Terraform workspace для отправки метрик и уведомлений
 */
export function createTerraformObservabilityRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: ['terraform'],
    targetTypes: ['prometheus', 'grafana', 'loki', 'jaeger', 'opentelemetry-collector'],
    priority: 10,
    
    updateSourceConfig: (source, target, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      
      // Получаем или создаем notifications массив для каждого workspace
      const targetLabel = target.data.label || target.type;
      const targetId = target.id;
      
      // Определяем условия отправки в зависимости от типа observability компонента
      let conditions: Array<'on_success' | 'on_failure' | 'on_start'>;
      if (target.type === 'prometheus' || target.type === 'grafana') {
        // Prometheus и Grafana получают метрики при любом исходе
        conditions = ['on_success', 'on_failure', 'on_start'];
      } else {
        // Логи и трейсы отправляются при любом исходе
        conditions = ['on_success', 'on_failure', 'on_start'];
      }
      
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        
        // Проверяем, есть ли уже notification для этого компонента
        const existingNotification = notifications.find((n: any) => 
          n.type === 'component' && n.destination === targetId
        );
        
        if (!existingNotification) {
          // Добавляем новую notification configuration
          notifications.push({
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: conditions,
            enabled: true,
            description: `Send run metrics and notifications to ${targetLabel}`,
          });
        }
        
        return {
          ...w,
          notifications,
        };
      });
      
      // Если нет workspaces, создаем дефолтный
      if (updatedWorkspaces.length === 0) {
        updatedWorkspaces.push({
          id: 'default',
          name: 'production',
          description: 'Production infrastructure',
          terraformVersion: sourceConfig.defaultTerraformVersion || '1.5.0',
          autoApply: false,
          queueAllRuns: true,
          notifications: [{
            id: `notification-${targetId}-${Date.now()}`,
            name: `Notify ${targetLabel}`,
            type: 'component',
            destination: targetId,
            conditions: conditions,
            enabled: true,
            description: `Send run metrics and notifications to ${targetLabel}`,
          }],
        });
      }
      
      return { workspaces: updatedWorkspaces };
    },
    
    cleanupSourceConfig: (source, target, connection, metadata) => {
      if (!source?.data) return null;
      
      const sourceConfig = source.data.config || {};
      const workspaces = Array.isArray(sourceConfig.workspaces) ? sourceConfig.workspaces : [];
      const targetId = target.id;
      
      // Удаляем notification для этого компонента
      const updatedWorkspaces = workspaces.map((w: any) => {
        const notifications = Array.isArray(w.notifications) ? w.notifications : [];
        const filteredNotifications = notifications.filter((n: any) => 
          !(n.type === 'component' && n.destination === targetId)
        );
        
        return {
          ...w,
          notifications: filteredNotifications,
        };
      });
      
      return { workspaces: updatedWorkspaces };
    },
  };
}
