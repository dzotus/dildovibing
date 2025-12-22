import { CanvasNode } from '@/types';

/**
 * Vault Secret configuration
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
  };

  private tokens: Map<string, VaultToken> = new Map();
  private secrets: Map<string, VaultSecret> = new Map();

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
    };

    // Initialize secrets map
    this.secrets.clear();
    secrets.forEach((secret) => {
      this.secrets.set(secret.id, secret);
    });
    this.metrics.secretsTotal = secrets.length;

    // Cleanup expired tokens
    this.cleanupExpiredTokens(Date.now());
  }

  /**
   * Обработать запрос чтения секрета
   */
  public processReadRequest(
    path: string,
    key?: string,
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
      this.metrics.readRequestsTotal++;
      return {
        success: false,
        latency,
        error: 'Vault not configured',
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

    // Find secret by path
    const secret = Array.from(this.secrets.values()).find(
      (s) => s.path === path && (!key || s.key === key)
    );

    const baseLatency = 15; // Base read latency
    const jitter = (Math.random() - 0.5) * 10;
    const latency = Math.max(5, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.readRequestsTotal++;

    if (!secret) {
      return {
        success: false,
        latency,
        error: `Secret not found at path: ${path}`,
      };
    }

    return {
      success: true,
      latency,
      data: {
        [secret.key]: secret.value,
        version: secret.version,
      },
    };
  }

  /**
   * Обработать запрос записи секрета
   */
  public processWriteRequest(
    path: string,
    data: Record<string, string>,
    token?: string
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

    const baseLatency = 25; // Base write latency (higher than read)
    const jitter = (Math.random() - 0.5) * 15;
    const latency = Math.max(10, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.writeRequestsTotal++;

    // Create or update secret
    const existingSecret = Array.from(this.secrets.values()).find(
      (s) => s.path === path && s.key === Object.keys(data)[0]
    );

    if (existingSecret) {
      // Update existing secret
      existingSecret.value = Object.values(data)[0];
      existingSecret.version = (existingSecret.version || 1) + 1;
      existingSecret.updated = new Date().toISOString();
      this.secrets.set(existingSecret.id, existingSecret);
    } else {
      // Create new secret
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

    return {
      success: true,
      latency,
      data: {
        path,
        version: existingSecret?.version || 1,
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

    const baseLatency = 20;
    const jitter = (Math.random() - 0.5) * 10;
    const latency = Math.max(8, baseLatency + jitter);
    this.recordLatency(latency);

    this.metrics.deleteRequestsTotal++;

    // Find and delete secret
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

    return {
      success: false,
      latency,
      error: `Secret not found at path: ${path}`,
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
}

