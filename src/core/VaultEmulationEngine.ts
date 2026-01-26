import { CanvasNode } from '@/types';

/**
 * KV v2 Secret Version metadata
 */
export interface KV2SecretVersion {
  version: number;
  created: string;
  deleted?: boolean;
  destroyed?: boolean;
}

/**
 * KV v2 Secret with versioning support
 */
export interface KV2Secret {
  path: string;
  versions: Map<number, { data: Record<string, string>; metadata: KV2SecretVersion }>;
  currentVersion: number;
  casRequired?: boolean;
}

/**
 * Vault Secret configuration (KV v1 - simple key-value)
 */
export interface VaultSecret {
  id: string;
  path: string;
  key: string;
  value: string;
  version?: number;
  created?: string;
  updated?: string;
  visible?: boolean;
}

/**
 * Vault Secret Engine configuration
 */
export interface VaultSecretEngine {
  id: string;
  name: string;
  type: 'kv' | 'transit' | 'pki' | 'database' | 'aws' | 'azure';
  enabled: boolean;
  version?: number;
  description?: string;
}

/**
 * Vault Policy configuration
 */
export interface VaultPolicy {
  id: string;
  name: string;
  rules: string;
  enabled: boolean;
}

/**
 * Vault Token configuration
 */
export interface VaultToken {
  id: string;
  token: string;
  policies: string[];
  ttl: number; // seconds
  renewable: boolean;
  createdAt: number; // ms
  expiresAt: number; // ms
}

/**
 * Storage Backend configuration
 */
export interface StorageBackendConfig {
  type: 'consul' | 'etcd' | 'file' | 's3' | 'inmem';
  address?: string;
  path?: string;
  haEnabled?: boolean;
}

/**
 * Seal/Unseal configuration
 */
export interface SealConfig {
  sealed: boolean;
  unsealThreshold: number; // Number of shards required (default: 3)
  unsealShares: number; // Total number of shards (default: 5)
  unsealProgress: number; // Current number of provided shards (0 to threshold)
  autoUnseal?: boolean; // Auto-unseal via KMS/HSM
}

/**
 * Конфигурация Vault, считываемая из node.data.config
 * (поля синхронизированы с SecretsVaultConfigAdvanced)
 */
export interface VaultEmulationConfig {
  vaultType: 'hashicorp' | 'aws' | 'azure';
  address: string;
  enableTLS: boolean;
  enableTransit: boolean;
  enableKV: boolean;
  kvVersion: string;
  enablePKI: boolean;
  enableAuth: boolean;
  authMethod: 'token' | 'approle' | 'ldap' | 'aws';
  tokenTTL: string; // e.g., "24h"
  secrets: VaultSecret[];
  engines: VaultSecretEngine[];
  policies: VaultPolicy[];
  sealed?: boolean;
  unsealThreshold?: number;
  unsealShares?: number;
  storageBackend?: StorageBackendConfig;
}

/**
 * Внутренние метрики Vault
 */
export interface VaultEngineMetrics {
  readRequestsTotal: number;
  writeRequestsTotal: number;
  deleteRequestsTotal: number;
  listRequestsTotal: number;
  authRequestsTotal: number;
  authErrorsTotal: number;
  tokenIssuedTotal: number;
  tokenRenewedTotal: number;
  tokenRevokedTotal: number;
  encryptionOperationsTotal: number;
  decryptionOperationsTotal: number;
  activeTokens: number;
  secretsTotal: number;
  vaultSealed: boolean;
  unsealAttemptsTotal: number;
  unsealSuccessTotal: number;
}

/**
 * Результат обработки Vault запроса
 */
export interface VaultRequestResult {
  success: boolean;
  latency: number; // ms
  error?: string;
  data?: unknown;
  token?: string;
  policies?: string[];
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface VaultLoad {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  activeTokens: number;
  secretsCount: number;
  enginesEnabled: number;
}

/**
 * Vault Emulation Engine
 * Симулирует работу HashiCorp Vault: управление секретами, аутентификация, шифрование, расчет метрик.
 *
 * Важно: это не полноценная реализация протоколов, а статистическая модель,
 * которая использует реальную структуру конфига и параметры времени жизни токенов.
 */
export class VaultEmulationEngine {
  private config: VaultEmulationConfig | null = null;

  private metrics: VaultEngineMetrics = {
    readRequestsTotal: 0,
    writeRequestsTotal: 0,
    deleteRequestsTotal: 0,
    listRequestsTotal: 0,
    authRequestsTotal: 0,
    authErrorsTotal: 0,
    tokenIssuedTotal: 0,
    tokenRenewedTotal: 0,
    tokenRevokedTotal: 0,
    encryptionOperationsTotal: 0,
    decryptionOperationsTotal: 0,
    activeTokens: 0,
    secretsTotal: 0,
    vaultSealed: true, // Vault starts sealed
    unsealAttemptsTotal: 0,
    unsealSuccessTotal: 0,
  };

  private tokens: Map<string, VaultToken> = new Map();
  private secrets: Map<string, VaultSecret> = new Map();
  // KV v2 secrets with versioning
  private kv2Secrets: Map<string, KV2Secret> = new Map();
  // Seal state
  private sealState: SealConfig = {
    sealed: true,
    unsealThreshold: 3,
    unsealShares: 5,
    unsealProgress: 0,
    autoUnseal: false,
  };

  // Для оценки RPS и средней латентности
  private firstRequestTime: number | null = null;
  private lastRequestTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;

  /**
   * Инициализация конфигурации из узла Vault
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    const secrets: VaultSecret[] = Array.isArray(raw.secrets)
      ? raw.secrets.map((s: any) => ({
          id: String(s.id ?? `secret-${Date.now()}`),
          path: String(s.path ?? 'secret/default'),
          key: String(s.key ?? 'key'),
          value: String(s.value ?? ''),
          version: Number(s.version ?? 1),
          created: s.created ? String(s.created) : new Date().toISOString(),
          updated: s.updated ? String(s.updated) : new Date().toISOString(),
          visible: s.visible ?? false,
        }))
      : [];

    const engines: VaultSecretEngine[] = Array.isArray(raw.engines)
      ? raw.engines.map((e: any) => ({
          id: String(e.id ?? `engine-${Date.now()}`),
          name: String(e.name ?? 'secret/'),
          type: (e.type ?? 'kv') as any,
          enabled: e.enabled ?? true,
          version: e.version ? Number(e.version) : undefined,
          description: e.description ? String(e.description) : undefined,
        }))
      : [
          {
            id: '1',
            name: 'secret/',
            type: 'kv',
            enabled: raw.enableKV ?? true,
            version: raw.kvVersion === '1' ? 1 : 2,
            description: 'Key-Value secrets',
          },
        ];

    const policies: VaultPolicy[] = Array.isArray(raw.policies)
      ? raw.policies.map((p: any) => ({
          id: String(p.id ?? `policy-${Date.now()}`),
          name: String(p.name ?? 'default'),
          rules: String(p.rules ?? 'path "*" { capabilities = ["read"] }'),
          enabled: p.enabled ?? true,
        }))
      : [
          {
            id: '1',
            name: 'default',
            rules: 'path "*" { capabilities = ["read", "list"] }',
            enabled: true,
          },
        ];

    // Parse token TTL (e.g., "24h" -> seconds)
    const tokenTTLStr = String(raw.tokenTTL || '24h');
    const tokenTTLSeconds = this.parseTTL(tokenTTLStr);

    // Initialize seal state
    this.sealState = {
      sealed: raw.sealed ?? true, // Vault starts sealed by default
      unsealThreshold: raw.unsealThreshold ?? 3,
      unsealShares: raw.unsealShares ?? 5,
      unsealProgress: 0,
      autoUnseal: raw.autoUnseal ?? false,
    };

    // Initialize storage backend
    const storageBackend: StorageBackendConfig = raw.storageBackend
      ? {
          type: raw.storageBackend.type || 'consul',
          address: raw.storageBackend.address,
          path: raw.storageBackend.path,
          haEnabled: raw.storageBackend.haEnabled ?? false,
        }
      : {
          type: 'consul',
          haEnabled: false,
        };

    this.config = {
      vaultType: (raw.vaultType || 'hashicorp') as 'hashicorp' | 'aws' | 'azure',
      address: String(raw.address || 'http://vault:8200'),
      enableTLS: raw.enableTLS ?? false,
      enableTransit: raw.enableTransit ?? true,
      enableKV: raw.enableKV ?? true,
      kvVersion: String(raw.kvVersion || '2'),
      enablePKI: raw.enablePKI ?? false,
      enableAuth: raw.enableAuth ?? true,
      authMethod: (raw.authMethod || 'token') as 'token' | 'approle' | 'ldap' | 'aws',
      tokenTTL: tokenTTLStr,
      secrets,
      engines,
      policies,
      sealed: this.sealState.sealed,
      unsealThreshold: this.sealState.unsealThreshold,
      unsealShares: this.sealState.unsealShares,
      storageBackend,
    };

    // Update metrics
    this.metrics.vaultSealed = this.sealState.sealed;

    // Initialize secrets map
    this.secrets.clear();
    this.kv2Secrets.clear();
    
    // Separate KV v1 and v2 secrets
    const kvVersion = this.config.kvVersion === '1' ? 1 : 2;
    secrets.forEach((secret) => {
      if (kvVersion === 2) {
        // Store as KV v2 with versioning
        const kv2Secret: KV2Secret = {
          path: secret.path,
          versions: new Map(),
          currentVersion: secret.version || 1,
          casRequired: false,
        };
        kv2Secret.versions.set(secret.version || 1, {
          data: { [secret.key]: secret.value },
          metadata: {
            version: secret.version || 1,
            created: secret.created || new Date().toISOString(),
          },
        });
        this.kv2Secrets.set(secret.path, kv2Secret);
      } else {
        // Store as KV v1 (simple key-value)
        this.secrets.set(secret.id, secret);
      }
    });
    
    // Count total secrets
    this.metrics.secretsTotal = kvVersion === 2 ? this.kv2Secrets.size : this.secrets.size;

    // Cleanup expired tokens
    this.cleanupExpiredTokens(Date.now());
  }

  /**
   * Seal Vault - блокирует все операции
   */
  public seal(): void {
    this.sealState.sealed = true;
    this.sealState.unsealProgress = 0;
    if (this.config) {
      this.config.sealed = true;
    }
    this.metrics.vaultSealed = true;
  }

  /**
   * Unseal Vault - требует определенное количество shards (Shamir's Secret Sharing)
   */
  public unseal(shards: string[]): { success: boolean; progress: number; threshold: number; error?: string } {
    this.metrics.unsealAttemptsTotal++;
    
    if (!this.sealState.sealed) {
      return {
        success: true,
        progress: this.sealState.unsealThreshold,
        threshold: this.sealState.unsealThreshold,
      };
    }

    // Validate shards (в реальности это криптографическая проверка)
    // Для симуляции просто проверяем количество
    if (!Array.isArray(shards) || shards.length === 0) {
      return {
        success: false,
        progress: this.sealState.unsealProgress,
        threshold: this.sealState.unsealThreshold,
        error: 'No unseal keys provided',
      };
    }

    // Increment progress for each valid shard
    const validShards = shards.filter((s) => s && s.trim().length > 0);
    this.sealState.unsealProgress = Math.min(
      this.sealState.unsealProgress + validShards.length,
      this.sealState.unsealThreshold
    );

    if (this.sealState.unsealProgress >= this.sealState.unsealThreshold) {
      this.sealState.sealed = false;
      if (this.config) {
        this.config.sealed = false;
      }
      this.metrics.vaultSealed = false;
      this.metrics.unsealSuccessTotal++;
      return {
        success: true,
        progress: this.sealState.unsealThreshold,
        threshold: this.sealState.unsealThreshold,
      };
    }

    return {
      success: false,
      progress: this.sealState.unsealProgress,
      threshold: this.sealState.unsealThreshold,
      error: `Unseal progress: ${this.sealState.unsealProgress}/${this.sealState.unsealThreshold}`,
    };
  }

  /**
   * Проверить состояние seal
   */
  public isSealed(): boolean {
    return this.sealState.sealed;
  }

  /**
   * Получить состояние seal
   */
  public getSealState(): SealConfig {
    return { ...this.sealState };
  }

  /**
   * Обработать запрос чтения секрета
   */
  public processReadRequest(
    path: string,
    key?: string,
    token?: string,
    version?: number
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.readRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.readRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.readRequestsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Check storage backend latency impact
    const storageLatency = this.getStorageLatency(config.storageBackend);

    // Determine KV version
    const kvVersion = config.kvVersion === '1' ? 1 : 2;

    let secretData: any = null;
    let secretVersion: number | undefined;

    if (kvVersion === 2) {
      // KV v2: support versioning
      const kv2Secret = this.kv2Secrets.get(path);
      if (kv2Secret) {
        const targetVersion = version || kv2Secret.currentVersion;
        const versionData = kv2Secret.versions.get(targetVersion);
        if (versionData && !versionData.metadata.deleted && !versionData.metadata.destroyed) {
          secretData = versionData.data;
          secretVersion = targetVersion;
        }
      }
    } else {
      // KV v1: simple key-value
      const secret = Array.from(this.secrets.values()).find(
        (s) => s.path === path && (!key || s.key === key)
      );
      if (secret) {
        secretData = { [secret.key]: secret.value };
        secretVersion = secret.version;
      }
    }

    const baseLatency = 15 + storageLatency; // Base read latency + storage impact
    const jitter = (Math.random() - 0.5) * 10;
    const latency = Math.max(5, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.readRequestsTotal++;

    if (!secretData) {
      return {
        success: false,
        latency,
        error: `Secret not found at path: ${path}${version ? ` (version ${version})` : ''}`,
      };
    }

    return {
      success: true,
      latency,
      data: {
        ...secretData,
        version: secretVersion,
      },
    };
  }

  /**
   * Обработать запрос записи секрета
   */
  public processWriteRequest(
    path: string,
    data: Record<string, string>,
    token?: string,
    cas?: number // Check-and-Set version for KV v2
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 60;
      this.recordLatency(latency);
      this.metrics.writeRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.writeRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.writeRequestsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Check if KV engine is enabled
    if (!config.enableKV) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.writeRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'KV engine is not enabled',
      };
    }

    // Check storage backend latency impact
    const storageLatency = this.getStorageLatency(config.storageBackend);

    const baseLatency = 25 + storageLatency; // Base write latency (higher than read)
    const jitter = (Math.random() - 0.5) * 15;
    const latency = Math.max(10, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.writeRequestsTotal++;

    // Determine KV version
    const kvVersion = config.kvVersion === '1' ? 1 : 2;
    let newVersion: number;

    if (kvVersion === 2) {
      // KV v2: support versioning and CAS
      const kv2Secret = this.kv2Secrets.get(path);
      
      if (kv2Secret) {
        // Check CAS if provided
        if (cas !== undefined && kv2Secret.currentVersion !== cas) {
          return {
            success: false,
            latency,
            error: `Check-and-Set failed: current version is ${kv2Secret.currentVersion}, expected ${cas}`,
          };
        }
        
        newVersion = kv2Secret.currentVersion + 1;
        kv2Secret.versions.set(newVersion, {
          data,
          metadata: {
            version: newVersion,
            created: new Date().toISOString(),
          },
        });
        kv2Secret.currentVersion = newVersion;
      } else {
        // Create new KV v2 secret
        newVersion = 1;
        const newKV2Secret: KV2Secret = {
          path,
          versions: new Map(),
          currentVersion: 1,
          casRequired: cas !== undefined,
        };
        newKV2Secret.versions.set(1, {
          data,
          metadata: {
            version: 1,
            created: new Date().toISOString(),
          },
        });
        this.kv2Secrets.set(path, newKV2Secret);
        this.metrics.secretsTotal = this.kv2Secrets.size;
      }
    } else {
      // KV v1: simple key-value, no versioning
      const existingSecret = Array.from(this.secrets.values()).find(
        (s) => s.path === path && s.key === Object.keys(data)[0]
      );

      if (existingSecret) {
        // Update existing secret
        existingSecret.value = Object.values(data)[0];
        existingSecret.version = (existingSecret.version || 1) + 1;
        existingSecret.updated = new Date().toISOString();
        this.secrets.set(existingSecret.id, existingSecret);
        newVersion = existingSecret.version;
      } else {
        // Create new secret
        newVersion = 1;
        const newSecret: VaultSecret = {
          id: `secret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          path,
          key: Object.keys(data)[0],
          value: Object.values(data)[0],
          version: 1,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          visible: false,
        };
        this.secrets.set(newSecret.id, newSecret);
        this.metrics.secretsTotal = this.secrets.size;
      }
    }

    return {
      success: true,
      latency,
      data: {
        path,
        version: newVersion,
      },
    };
  }

  /**
   * Обработать запрос удаления секрета
   */
  public processDeleteRequest(
    path: string,
    token?: string
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.deleteRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.deleteRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.deleteRequestsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Check storage backend latency impact
    const storageLatency = this.getStorageLatency(config.storageBackend);

    const baseLatency = 20 + storageLatency;
    const jitter = (Math.random() - 0.5) * 10;
    const latency = Math.max(8, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.deleteRequestsTotal++;

    // Determine KV version
    const kvVersion = config.kvVersion === '1' ? 1 : 2;

    if (kvVersion === 2) {
      // KV v2: soft delete (mark as deleted)
      const kv2Secret = this.kv2Secrets.get(path);
      if (kv2Secret) {
        const currentVersion = kv2Secret.currentVersion;
        const versionData = kv2Secret.versions.get(currentVersion);
        if (versionData) {
          versionData.metadata.deleted = true;
          versionData.metadata.created = new Date().toISOString();
          return {
            success: true,
            latency,
            data: {
              path,
              version: currentVersion,
              deleted: true,
            },
          };
        }
      }
    } else {
      // KV v1: hard delete
      const secretToDelete = Array.from(this.secrets.values()).find(
        (s) => s.path === path
      );

      if (secretToDelete) {
        this.secrets.delete(secretToDelete.id);
        this.metrics.secretsTotal = this.secrets.size;
        return {
          success: true,
          latency,
        };
      }
    }

    return {
      success: false,
      latency,
      error: `Secret not found at path: ${path}`,
    };
  }

  /**
   * Обработать запрос списка секретов (List operation)
   */
  public processListRequest(
    path: string,
    token?: string
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.listRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.listRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.listRequestsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Check storage backend latency impact
    const storageLatency = this.getStorageLatency(config.storageBackend);

    const baseLatency = 20 + storageLatency;
    const jitter = (Math.random() - 0.5) * 10;
    const latency = Math.max(10, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.listRequestsTotal++;

    // Determine KV version
    const kvVersion = config.kvVersion === '1' ? 1 : 2;
    const keys: string[] = [];

    if (kvVersion === 2) {
      // KV v2: list paths with metadata
      for (const [secretPath, kv2Secret] of this.kv2Secrets.entries()) {
        if (secretPath.startsWith(path)) {
          const relativePath = secretPath.substring(path.length).replace(/^\//, '');
          if (relativePath && !relativePath.includes('/')) {
            // Only direct children
            keys.push(relativePath);
          }
        }
      }
    } else {
      // KV v1: list keys
      const pathPrefix = path.endsWith('/') ? path : path + '/';
      const seenKeys = new Set<string>();
      for (const secret of this.secrets.values()) {
        if (secret.path.startsWith(pathPrefix)) {
          const relativePath = secret.path.substring(pathPrefix.length);
          const key = relativePath.split('/')[0];
          if (key && !seenKeys.has(key)) {
            keys.push(key);
            seenKeys.add(key);
          }
        }
      }
    }

    return {
      success: true,
      latency,
      data: {
        keys: keys.sort(),
      },
    };
  }

  /**
   * Обработать запрос аутентификации
   */
  public processAuthRequest(
    method: 'token' | 'approle' | 'ldap' | 'aws',
    payload: Record<string, unknown>
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.authRequestsTotal++;
      this.metrics.authErrorsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Auth operations can work even when sealed (for initial unseal)
    // But we check it for consistency
    if (this.sealState.sealed && method !== 'token') {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.authRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    if (!config.enableAuth) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.authRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Authentication is not enabled',
      };
    }

    // Base latency depends on auth method
    let baseLatency = 40;
    if (method === 'ldap') {
      baseLatency = 80; // LDAP is slower
    } else if (method === 'approle') {
      baseLatency = 50;
    } else if (method === 'aws') {
      baseLatency = 60;
    }

    const jitter = (Math.random() - 0.5) * 20;
    const latency = Math.max(15, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.authRequestsTotal++;

    // Generate token
    const tokenTTLSeconds = this.parseTTL(config.tokenTTL);
    const tokenId = `vault-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const token: VaultToken = {
      id: tokenId,
      token: tokenId,
      policies: config.policies.filter((p) => p.enabled).map((p) => p.name),
      ttl: tokenTTLSeconds,
      renewable: true,
      createdAt: now,
      expiresAt: now + tokenTTLSeconds * 1000,
    };

    this.tokens.set(tokenId, token);
    this.metrics.tokenIssuedTotal++;
    this.metrics.activeTokens = this.tokens.size;

    return {
      success: true,
      latency,
      token: tokenId,
      policies: token.policies,
    };
  }

  /**
   * Обработать операцию шифрования (Transit engine)
   */
  public processEncryptRequest(
    plaintext: string,
    keyName: string = 'default',
    token?: string
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.encryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.encryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    if (!config.enableTransit) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.encryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Transit engine is not enabled',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.encryptionOperationsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Encryption latency depends on data size
    const dataSize = plaintext.length;
    const baseLatency = 30 + Math.min(100, dataSize / 100); // Base + size factor
    const jitter = (Math.random() - 0.5) * 15;
    const latency = Math.max(15, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.encryptionOperationsTotal++;

    // Simulate encrypted data (base64-like)
    const encrypted = Buffer.from(plaintext).toString('base64');

    return {
      success: true,
      latency,
      data: {
        ciphertext: `vault:v1:${encrypted}`,
        key: keyName,
      },
    };
  }

  /**
   * Обработать операцию дешифрования (Transit engine)
   */
  public processDecryptRequest(
    ciphertext: string,
    keyName: string = 'default',
    token?: string
  ): VaultRequestResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredTokens(now);

    const config = this.config;
    if (!config) {
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.decryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
      };
    }

    // Check if Vault is sealed
    if (this.sealState.sealed) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.decryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault is sealed',
      };
    }

    if (!config.enableTransit) {
      const latency = 20;
      this.recordLatency(latency);
      this.metrics.decryptionOperationsTotal++;
      return {
        success: false,
        latency,
        error: 'Transit engine is not enabled',
      };
    }

    // Check authentication if enabled
    if (config.enableAuth && token) {
      const tokenValid = this.validateToken(token, now);
      if (!tokenValid) {
        const latency = 30;
        this.recordLatency(latency);
        this.metrics.decryptionOperationsTotal++;
        this.metrics.authErrorsTotal++;
        return {
          success: false,
          latency,
          error: 'Invalid or expired token',
        };
      }
    }

    // Decryption latency
    const baseLatency = 25 + Math.min(80, ciphertext.length / 150);
    const jitter = (Math.random() - 0.5) * 12;
    const latency = Math.max(12, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.decryptionOperationsTotal++;

    // Simulate decryption (extract from vault:v1: format)
    const encryptedPart = ciphertext.replace(/^vault:v1:/, '');
    let plaintext: string;
    try {
      plaintext = Buffer.from(encryptedPart, 'base64').toString('utf-8');
    } catch {
      return {
        success: false,
        latency,
        error: 'Invalid ciphertext format',
      };
    }

    return {
      success: true,
      latency,
      data: {
        plaintext,
        key: keyName,
      },
    };
  }

  /**
   * Рассчитывает агрегированную нагрузку для EmulationEngine
   */
  public calculateLoad(): VaultLoad {
    const m = this.metrics;

    const totalRequests =
      m.readRequestsTotal +
      m.writeRequestsTotal +
      m.deleteRequestsTotal +
      m.listRequestsTotal +
      m.authRequestsTotal +
      m.encryptionOperationsTotal +
      m.decryptionOperationsTotal;

    const errorRate =
      totalRequests > 0
        ? Math.min(1, m.authErrorsTotal / totalRequests)
        : 0;

    const avgLatency =
      this.latencyHistory.length > 0
        ? this.latencyHistory.reduce((a, b) => a + b, 0) /
          this.latencyHistory.length
        : 0;

    let rps = 0;
    if (
      this.firstRequestTime &&
      this.lastRequestTime &&
      this.lastRequestTime > this.firstRequestTime
    ) {
      const seconds = (this.lastRequestTime - this.firstRequestTime) / 1000;
      rps = totalRequests / Math.max(seconds, 1);
    }

    const enginesEnabled =
      this.config?.engines.filter((e) => e.enabled).length || 0;

    return {
      requestsPerSecond: rps,
      averageLatency: avgLatency,
      errorRate,
      activeTokens: this.metrics.activeTokens,
      secretsCount: this.metrics.secretsTotal,
      enginesEnabled,
    };
  }

  /**
   * Получить внутренние метрики двигателя
   */
  public getMetrics(): VaultEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить текущую конфигурацию (для отладочных панелей)
   */
  public getConfig(): VaultEmulationConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Получить список секретов
   */
  public getSecrets(): VaultSecret[] {
    return Array.from(this.secrets.values());
  }

  /**
   * Получить список активных токенов
   */
  public getActiveTokens(): VaultToken[] {
    const now = Date.now();
    this.cleanupExpiredTokens(now);
    return Array.from(this.tokens.values());
  }

  // ===== Вспомогательная логика =====

  private parseTTL(ttlStr: string): number {
    // Parse TTL string like "24h", "30m", "3600s"
    const match = ttlStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 86400; // Default 24h
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 86400;
    }
  }

  private validateToken(token: string, now: number): boolean {
    const tokenObj = this.tokens.get(token);
    if (!tokenObj) {
      return false;
    }

    if (now > tokenObj.expiresAt) {
      this.tokens.delete(token);
      this.metrics.activeTokens = this.tokens.size;
      return false;
    }

    return true;
  }

  private recordLatency(latency: number) {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
  }

  private cleanupExpiredTokens(now: number) {
    let expired = 0;
    for (const [id, token] of this.tokens.entries()) {
      if (now > token.expiresAt) {
        this.tokens.delete(id);
        expired++;
      }
    }
    if (expired > 0) {
      this.metrics.tokenRevokedTotal += expired;
      this.metrics.activeTokens = this.tokens.size;
    }
  }

  /**
   * Получить латентность storage backend
   */
  private getStorageLatency(storageBackend?: StorageBackendConfig): number {
    if (!storageBackend) {
      return 0; // Default: no latency impact
    }

    switch (storageBackend.type) {
      case 'consul':
        return 2; // Low latency, high availability
      case 'etcd':
        return 5; // Medium latency
      case 'file':
        return 10; // Higher latency, lower availability
      case 's3':
        return 15; // High latency, high availability
      case 'inmem':
        return 0; // Very low latency, no persistence
      default:
        return 0;
    }
  }
}

