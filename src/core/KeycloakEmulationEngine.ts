import { CanvasNode } from '@/types';

/**
 * Keycloak Client configuration (упрощённая модель клиента)
 */
export interface KeycloakClient {
  id: string;
  name: string;
  type: 'public' | 'confidential' | string;
  enabled: boolean;
  protocol: 'openid-connect' | 'saml' | string;
}

/**
 * Keycloak User configuration (упрощённая модель пользователя)
 */
export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  enabled: boolean;
  roles: string[];
}

/**
 * Конфигурация Keycloak, считываемая из node.data.config
 * (поля синхронизированы с KeycloakConfigAdvanced / SECURITY_PROFILES)
 */
export interface KeycloakEmulationConfig {
  realm: string;
  adminUrl: string;
  enableSSL: boolean;
  sslRequired: 'external' | 'all' | 'none';
  accessTokenLifespan: number; // seconds
  ssoSessionIdle: number; // seconds
  ssoSessionMax: number; // seconds
  enableOAuth2: boolean;
  enableSAML: boolean;
  enableLDAP: boolean;
  passwordPolicy: string;
  clients: KeycloakClient[];
  users: KeycloakUser[];
}

/**
 * Внутренние метрики Keycloak
 */
export interface KeycloakEngineMetrics {
  loginRequestsTotal: number;
  loginErrorsTotal: number;
  tokenRefreshTotal: number;
  introspectionRequestsTotal: number;
  userInfoRequestsTotal: number;
  sessionsCreatedTotal: number;
  sessionsExpiredTotal: number;
  activeSessions: number;
}

/**
 * Сессия пользователя в Keycloak
 */
interface KeycloakSession {
  sessionId: string;
  userId: string;
  clientId: string;
  realm: string;
  createdAt: number; // ms
  lastAccess: number; // ms
  idleTimeoutMs: number;
  maxLifespanMs: number;
}

/**
 * Результат обработки auth-запроса
 */
export interface KeycloakAuthResult {
  success: boolean;
  latency: number; // ms
  error?: string;
  tokenType?: 'access' | 'refresh' | 'id';
  expiresIn?: number; // seconds
  subject?: string;
  clientId?: string;
  realm?: string;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface KeycloakLoad {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  activeSessions: number;
  authSuccessRate: number;
}

/**
 * Keycloak Emulation Engine
 * Симулирует работу Keycloak: аутентификация, выдача токенов, поддержка сессий и расчет нагрузки.
 *
 * Важно: это не полноценная реализация протоколов, а статистическая модель,
 * которая использует реальную структуру конфига и параметры времени жизни токенов.
 */
export class KeycloakEmulationEngine {
  private config: KeycloakEmulationConfig | null = null;

  private metrics: KeycloakEngineMetrics = {
    loginRequestsTotal: 0,
    loginErrorsTotal: 0,
    tokenRefreshTotal: 0,
    introspectionRequestsTotal: 0,
    userInfoRequestsTotal: 0,
    sessionsCreatedTotal: 0,
    sessionsExpiredTotal: 0,
    activeSessions: 0,
  };

  private sessions: Map<string, KeycloakSession> = new Map();

  // Для оценки RPS и средней латентности
  private firstRequestTime: number | null = null;
  private lastRequestTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;

  /**
   * Инициализация конфигурации из узла Keycloak
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    const clients: KeycloakClient[] = Array.isArray(raw.clients)
      ? raw.clients.map((c: any) => ({
          id: String(c.id ?? c.clientId ?? 'client'),
          name: String(c.name ?? c.id ?? 'Client'),
          type: (c.type ?? 'public') as any,
          enabled: c.enabled ?? true,
          protocol: (c.protocol ?? 'openid-connect') as any,
        }))
      : [
          {
            id: 'archiphoenix-app',
            name: 'ArchiPhoenix App',
            type: 'public',
            enabled: true,
            protocol: 'openid-connect',
          },
        ];

    const users: KeycloakUser[] = Array.isArray(raw.users)
      ? raw.users.map((u: any) => ({
          id: String(u.id ?? u.username ?? 'user'),
          username: String(u.username ?? `user-${u.id ?? '1'}`),
          email: u.email ? String(u.email) : undefined,
          enabled: u.enabled ?? true,
          roles: Array.isArray(u.roles) ? u.roles.map((r: any) => String(r)) : [],
        }))
      : [
          {
            id: '1',
            username: 'admin',
            email: 'admin@archiphoenix.com',
            enabled: true,
            roles: ['admin', 'user'],
          },
        ];

    this.config = {
      realm: String(raw.realm || 'archiphoenix'),
      adminUrl: String(raw.adminUrl || 'http://keycloak:8080'),
      enableSSL: raw.enableSSL ?? false,
      sslRequired: (raw.sslRequired || 'external') as 'external' | 'all' | 'none',
      accessTokenLifespan: Number(raw.accessTokenLifespan || 300),
      ssoSessionIdle: Number(raw.ssoSessionIdle || 1800),
      ssoSessionMax: Number(raw.ssoSessionMax || 36000),
      enableOAuth2: raw.enableOAuth2 ?? true,
      enableSAML: raw.enableSAML ?? false,
      enableLDAP: raw.enableLDAP ?? false,
      passwordPolicy: String(raw.passwordPolicy || 'length(8)'),
      clients,
      users,
    };
  }

  /**
   * Обработать запрос аутентификации/авторизации.
   * Типы:
   *  - login      — интерактивный вход пользователя
   *  - refresh    — обновление токена
   *  - introspect — introspection токена
   *  - userinfo   — /userinfo запрос
   */
  public processAuthRequest(
    type: 'login' | 'refresh' | 'introspect' | 'userinfo',
    payload: {
      clientId?: string;
      username?: string;
      subject?: string;
      grantType?: string;
    }
  ): KeycloakAuthResult {
    const now = Date.now();
    this.firstRequestTime ??= now;
    this.lastRequestTime = now;

    this.cleanupExpiredSessions(now);

    const config = this.config;
    if (!config) {
      // Keycloak не сконфигурирован — считаем, что он "упал"
      const latency = 50;
      this.recordLatency(latency);
      this.metrics.loginErrorsTotal++;
      return {
        success: false,
        latency,
        error: 'Keycloak not configured',
      };
    }

    const clientId = payload.clientId || this.inferDefaultClientId();
    const client = config.clients.find((c) => c.id === clientId && c.enabled);

    // Базовая латентность зависит от типа операции
    let baseLatency =
      type === 'login'
        ? 80
        : type === 'refresh'
        ? 40
        : type === 'introspect'
        ? 60
        : 40; // userinfo

    // Учитываем сложность password policy для login
    if (type === 'login') {
      baseLatency += this.estimatePasswordPolicyCost(config.passwordPolicy);
    }

    // Учитываем LDAP, если включен
    if (config.enableLDAP) {
      baseLatency *= 1.3;
    }

    // Лёгкий jitter
    const jitter = (Math.random() - 0.5) * 20;
    const latency = Math.max(10, baseLatency + jitter);
    this.recordLatency(latency);

    // Проверяем клиента
    if (!client) {
      this.metrics.loginErrorsTotal++;
      this.bumpCounter(type);
      return {
        success: false,
        latency,
        error: `Client ${clientId} not found or disabled`,
        clientId,
        realm: config.realm,
      };
    }

    // Проверяем пользователя только для login / userinfo
    let user: KeycloakUser | undefined;
    if (type === 'login' || type === 'userinfo') {
      const username = payload.username || payload.subject;
      if (username) {
        user = config.users.find((u) => u.username === username);
      }

      if (!user || !user.enabled) {
        this.metrics.loginErrorsTotal++;
        this.bumpCounter(type);
        return {
          success: false,
          latency,
          error: `User ${username || 'unknown'} not found or disabled`,
          clientId,
          realm: config.realm,
        };
      }
    }

    // В зависимости от типа, обновляем сессии/счётчики
    switch (type) {
      case 'login': {
        this.metrics.loginRequestsTotal++;
        const sessionId = this.createOrUpdateSession(now, config, clientId, user!);
        return {
          success: true,
          latency,
          tokenType: 'access',
          expiresIn: config.accessTokenLifespan,
          subject: user!.username,
          clientId,
          realm: config.realm,
        };
      }
      case 'refresh': {
        this.metrics.tokenRefreshTotal++;
        // Обновляем lastAccess всех сессий субъекта, если он есть
        if (payload.subject) {
          this.touchUserSessions(now, payload.subject);
        }
        return {
          success: true,
          latency,
          tokenType: 'access',
          expiresIn: config.accessTokenLifespan,
          subject: payload.subject,
          clientId,
          realm: config.realm,
        };
      }
      case 'introspect': {
        this.metrics.introspectionRequestsTotal++;
        return {
          success: true,
          latency,
          tokenType: 'access',
          expiresIn: config.accessTokenLifespan,
          subject: payload.subject,
          clientId,
          realm: config.realm,
        };
      }
      case 'userinfo': {
        this.metrics.userInfoRequestsTotal++;
        return {
          success: true,
          latency,
          tokenType: 'id',
          expiresIn: config.accessTokenLifespan,
          subject: user?.username ?? payload.subject,
          clientId,
          realm: config.realm,
        };
      }
    }
  }

  /**
   * Рассчитывает агрегированную нагрузку для EmulationEngine
   */
  public calculateLoad(): KeycloakLoad {
    const m = this.metrics;

    const totalRequests =
      m.loginRequestsTotal +
      m.tokenRefreshTotal +
      m.introspectionRequestsTotal +
      m.userInfoRequestsTotal;

    const errorRate =
      totalRequests > 0 ? Math.min(1, m.loginErrorsTotal / totalRequests) : 0;

    const avgLatency =
      this.latencyHistory.length > 0
        ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
        : 0;

    let rps = 0;
    if (this.firstRequestTime && this.lastRequestTime && this.lastRequestTime > this.firstRequestTime) {
      const seconds = (this.lastRequestTime - this.firstRequestTime) / 1000;
      rps = totalRequests / Math.max(seconds, 1);
    }

    const authSuccessRate =
      m.loginRequestsTotal > 0
        ? 1 - m.loginErrorsTotal / m.loginRequestsTotal
        : 1;

    return {
      requestsPerSecond: rps,
      averageLatency: avgLatency,
      errorRate,
      activeSessions: this.metrics.activeSessions,
      authSuccessRate,
    };
  }

  /**
   * Получить внутренние метрики двигателя
   */
  public getMetrics(): KeycloakEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить текущую конфигурацию (для отладочных панелей)
   */
  public getConfig(): KeycloakEmulationConfig | null {
    return this.config ? { ...this.config } : null;
  }

  // ===== Вспомогательная логика =====

  private inferDefaultClientId(): string {
    if (!this.config?.clients.length) {
      return 'default-client';
    }
    // Первый включённый клиент считаем дефолтным
    const enabled = this.config.clients.filter((c) => c.enabled);
    return (enabled[0] || this.config.clients[0]).id;
  }

  /**
   * Оценка «стоимости» password policy в мс.
   * Чем сложнее политика, тем дороже операции аутентификации.
   */
  private estimatePasswordPolicyCost(policy: string): number {
    if (!policy) return 0;

    let cost = 0;
    const lowerPolicy = policy.toLowerCase();

    if (lowerPolicy.includes('length(')) cost += 10;
    if (lowerPolicy.includes('digits(')) cost += 15;
    if (lowerPolicy.includes('special(')) cost += 20;
    if (lowerPolicy.includes('uppercase(')) cost += 10;
    if (lowerPolicy.includes('lowercase(')) cost += 5;

    // Несколько правил одновременно повышают стоимость нелинейно
    const ruleCount = (policy.match(/\)/g) || []).length;
    cost += ruleCount * 5;

    return cost;
  }

  private recordLatency(latency: number) {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
  }

  private bumpCounter(type: 'login' | 'refresh' | 'introspect' | 'userinfo') {
    switch (type) {
      case 'login':
        this.metrics.loginRequestsTotal++;
        break;
      case 'refresh':
        this.metrics.tokenRefreshTotal++;
        break;
      case 'introspect':
        this.metrics.introspectionRequestsTotal++;
        break;
      case 'userinfo':
        this.metrics.userInfoRequestsTotal++;
        break;
    }
  }

  private createOrUpdateSession(
    now: number,
    config: KeycloakEmulationConfig,
    clientId: string,
    user: KeycloakUser
  ): string {
    // Пытаемся найти существующую сессию для пары user+client
    for (const session of this.sessions.values()) {
      if (session.userId === user.id && session.clientId === clientId) {
        session.lastAccess = now;
        return session.sessionId;
      }
    }

    const sessionId = `sess-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const idleTimeoutMs = config.ssoSessionIdle * 1000;
    const maxLifespanMs = config.ssoSessionMax * 1000;

    const session: KeycloakSession = {
      sessionId,
      userId: user.id,
      clientId,
      realm: config.realm,
      createdAt: now,
      lastAccess: now,
      idleTimeoutMs,
      maxLifespanMs,
    };

    this.sessions.set(sessionId, session);
    this.metrics.sessionsCreatedTotal++;
    this.metrics.activeSessions = this.sessions.size;
    return sessionId;
  }

  private touchUserSessions(now: number, username: string) {
    if (!this.config) return;
    const user = this.config.users.find((u) => u.username === username);
    if (!user) return;

    for (const session of this.sessions.values()) {
      if (session.userId === user.id) {
        session.lastAccess = now;
      }
    }
  }

  private cleanupExpiredSessions(now: number) {
    let expired = 0;
    for (const [id, session] of this.sessions.entries()) {
      const idleExpired = now - session.lastAccess > session.idleTimeoutMs;
      const maxExpired = now - session.createdAt > session.maxLifespanMs;
      if (idleExpired || maxExpired) {
        this.sessions.delete(id);
        expired++;
      }
    }
    if (expired > 0) {
      this.metrics.sessionsExpiredTotal += expired;
      this.metrics.activeSessions = this.sessions.size;
    }
  }
}


