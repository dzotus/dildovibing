import { CanvasNode } from '@/types';

/**
 * Keycloak Client configuration (расширенная модель клиента)
 */
export interface KeycloakClient {
  id: string;
  name: string;
  type: 'public' | 'confidential' | 'bearer-only' | string;
  enabled: boolean;
  protocol: 'openid-connect' | 'saml' | string;
  clientId?: string;
  clientSecret?: string;
  redirectUris?: string[];
  webOrigins?: string[];
  grantTypes?: string[];
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  authorizationServicesEnabled?: boolean;
  consentRequired?: boolean;
  defaultClientScopes?: string[];
  optionalClientScopes?: string[];
  roles?: string[];
}

/**
 * Keycloak User configuration (расширенная модель пользователя)
 */
export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  enabled: boolean;
  roles: string[];
  groups?: string[];
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>; // clientId -> roles
}

/**
 * Protocol Mapper
 */
export interface ProtocolMapper {
  id: string;
  name: string;
  protocolMapper: string; // 'oidc-usermodel-property-mapper', etc.
  config: Record<string, string>;
}

/**
 * Client Scope
 */
export interface KeycloakClientScope {
  id: string;
  name: string;
  protocol: 'openid-connect' | 'saml';
  protocolMappers?: ProtocolMapper[];
  attributes?: Record<string, string>;
}

/**
 * Email конфигурация для SMTP
 */
export interface KeycloakEmailConfig {
  host?: string;
  port?: number;
  from?: string;
  fromDisplayName?: string;
  replyTo?: string;
  replyToDisplayName?: string;
  enableSsl?: boolean;
  enableStartTls?: boolean;
  enableAuthentication?: boolean;
  user?: string;
  password?: string;
}

/**
 * Events конфигурация
 */
export interface KeycloakEventsConfig {
  enabled?: boolean;
  eventsEnabled?: boolean;
  adminEventsEnabled?: boolean;
  eventsExpiration?: number;
  adminEventsDetailsEnabled?: boolean;
}

/**
 * Identity Provider конфигурация
 */
export interface KeycloakIdentityProvider {
  id: string;
  alias: string;
  providerId: 'google' | 'github' | 'facebook' | 'saml' | 'oidc' | 'ldap' | string;
  enabled: boolean;
  displayName?: string;
  config?: Record<string, string>;
}

/**
 * Authentication Flow Execution
 */
export interface KeycloakAuthenticationExecution {
  id: string;
  requirement: 'REQUIRED' | 'ALTERNATIVE' | 'DISABLED' | 'CONDITIONAL';
  displayName: string;
  configurable: boolean;
  providerId: string;
}

/**
 * Authentication Flow конфигурация
 */
export interface KeycloakAuthenticationFlow {
  id: string;
  alias: string;
  description?: string;
  providerId: string;
  topLevel: boolean;
  builtIn: boolean;
  executions?: KeycloakAuthenticationExecution[];
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
  refreshTokenLifespan?: number; // seconds
  ssoSessionIdle: number; // seconds
  ssoSessionMax: number; // seconds
  enableOAuth2: boolean;
  enableSAML: boolean;
  enableLDAP: boolean;
  passwordPolicy: string;
  clients: KeycloakClient[];
  users: KeycloakUser[];
  clientScopes?: KeycloakClientScope[];
  refreshTokenLifespan?: number;
  email?: KeycloakEmailConfig;
  events?: KeycloakEventsConfig;
  identityProviders?: KeycloakIdentityProvider[];
  authenticationFlows?: KeycloakAuthenticationFlow[];
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
  emailsSentTotal: number;
  emailErrorsTotal: number;
  eventsTotal: number;
  adminEventsTotal: number;
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
 * OAuth2/OIDC Request
 */
export interface KeycloakOAuth2Request {
  grantType: 'authorization_code' | 'implicit' | 'client_credentials' | 'password' | 'refresh_token';
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  code?: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  scope?: string[];
}

/**
 * OAuth2/OIDC Response
 */
export interface KeycloakOAuth2Response {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope?: string;
  refreshExpiresIn?: number;
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
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
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
    emailsSentTotal: 0,
    emailErrorsTotal: 0,
    eventsTotal: 0,
    adminEventsTotal: 0,
  };

  private sessions: Map<string, KeycloakSession> = new Map();

  // Для оценки RPS и средней латентности
  private firstRequestTime: number | null = null;
  private lastRequestTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;

  /**
   * Обновление конфигурации (для переинициализации при изменении в UI)
   */
  public updateConfig(node: CanvasNode): void {
    // Сохраняем активные сессии перед обновлением
    const activeSessions = this.sessions.size;
    
    // Переинициализируем конфигурацию
    this.initializeConfig(node);
    
    // Восстанавливаем количество активных сессий (упрощенно)
    this.metrics.activeSessions = activeSessions;
  }

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
          enabled: c.enabled !== false,
          protocol: (c.protocol ?? 'openid-connect') as any,
          clientId: c.clientId ? String(c.clientId) : String(c.id ?? c.clientId ?? 'client'),
          clientSecret: c.clientSecret ? String(c.clientSecret) : undefined,
          redirectUris: Array.isArray(c.redirectUris) ? c.redirectUris.map((u: any) => String(u)) : [],
          webOrigins: Array.isArray(c.webOrigins) ? c.webOrigins.map((o: any) => String(o)) : [],
          grantTypes: Array.isArray(c.grantTypes) ? c.grantTypes.map((g: any) => String(g)) : undefined,
          standardFlowEnabled: c.standardFlowEnabled ?? c.standardFlowEnabled !== false,
          implicitFlowEnabled: c.implicitFlowEnabled ?? false,
          directAccessGrantsEnabled: c.directAccessGrantsEnabled ?? c.directAccessGrantsEnabled !== false,
          serviceAccountsEnabled: c.serviceAccountsEnabled ?? false,
          authorizationServicesEnabled: c.authorizationServicesEnabled ?? false,
          consentRequired: c.consentRequired ?? false,
          defaultClientScopes: Array.isArray(c.defaultClientScopes) ? c.defaultClientScopes.map((s: any) => String(s)) : [],
          optionalClientScopes: Array.isArray(c.optionalClientScopes) ? c.optionalClientScopes.map((s: any) => String(s)) : [],
          roles: Array.isArray(c.roles) ? c.roles.map((r: any) => String(r)) : [],
        }))
      : [];

    const users: KeycloakUser[] = Array.isArray(raw.users)
      ? raw.users.map((u: any) => ({
          id: String(u.id ?? u.username ?? 'user'),
          username: String(u.username ?? `user-${u.id ?? '1'}`),
          email: u.email ? String(u.email) : undefined,
          enabled: u.enabled !== false,
          roles: Array.isArray(u.roles) ? u.roles.map((r: any) => String(r)) : [],
          groups: Array.isArray(u.groups) ? u.groups.map((g: any) => String(g)) : [],
          realmRoles: Array.isArray(u.realmRoles) ? u.realmRoles.map((r: any) => String(r)) : [],
          clientRoles: u.clientRoles && typeof u.clientRoles === 'object' 
            ? Object.fromEntries(
                Object.entries(u.clientRoles).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.map((r: any) => String(r)) : []
                ])
              )
            : undefined,
        }))
      : [];

    const clientScopes: KeycloakClientScope[] = Array.isArray(raw.clientScopes)
      ? raw.clientScopes.map((s: any) => ({
          id: String(s.id ?? s.name ?? 'scope'),
          name: String(s.name ?? s.id ?? 'scope'),
          protocol: (s.protocol ?? 'openid-connect') as 'openid-connect' | 'saml',
          protocolMappers: Array.isArray(s.protocolMappers)
            ? s.protocolMappers.map((m: any) => ({
                id: String(m.id ?? m.name ?? 'mapper'),
                name: String(m.name ?? m.id ?? 'mapper'),
                protocolMapper: String(m.protocolMapper ?? 'oidc-usermodel-property-mapper'),
                config: m.config && typeof m.config === 'object' 
                  ? Object.fromEntries(
                      Object.entries(m.config).map(([k, v]) => [k, String(v)])
                    )
                  : {},
              }))
            : [],
          attributes: s.attributes && typeof s.attributes === 'object'
            ? Object.fromEntries(
                Object.entries(s.attributes).map(([k, v]) => [k, String(v)])
              )
            : {},
        }))
      : [];

    // Email конфигурация
    const emailConfig: KeycloakEmailConfig | undefined = raw.email && typeof raw.email === 'object'
      ? {
          host: raw.email.host ? String(raw.email.host) : undefined,
          port: raw.email.port ? Number(raw.email.port) : undefined,
          from: raw.email.from ? String(raw.email.from) : undefined,
          fromDisplayName: raw.email.fromDisplayName ? String(raw.email.fromDisplayName) : undefined,
          replyTo: raw.email.replyTo ? String(raw.email.replyTo) : undefined,
          replyToDisplayName: raw.email.replyToDisplayName ? String(raw.email.replyToDisplayName) : undefined,
          enableSsl: raw.email.enableSsl ?? false,
          enableStartTls: raw.email.enableStartTls ?? false,
          enableAuthentication: raw.email.enableAuthentication ?? false,
          user: raw.email.user ? String(raw.email.user) : undefined,
          password: raw.email.password ? String(raw.email.password) : undefined,
        }
      : undefined;

    // Events конфигурация
    const eventsConfig: KeycloakEventsConfig | undefined = raw.events && typeof raw.events === 'object'
      ? {
          enabled: raw.events.enabled ?? false,
          eventsEnabled: raw.events.eventsEnabled ?? false,
          adminEventsEnabled: raw.events.adminEventsEnabled ?? false,
          eventsExpiration: raw.events.eventsExpiration ? Number(raw.events.eventsExpiration) : undefined,
          adminEventsDetailsEnabled: raw.events.adminEventsDetailsEnabled ?? false,
        }
      : undefined;

    // Identity Providers конфигурация
    const identityProviders: KeycloakIdentityProvider[] = Array.isArray(raw.identityProviders)
      ? raw.identityProviders.map((p: any) => ({
          id: String(p.id ?? `idp-${Date.now()}`),
          alias: String(p.alias ?? p.providerId ?? 'idp'),
          providerId: String(p.providerId ?? 'oidc') as any,
          enabled: p.enabled !== false,
          displayName: p.displayName ? String(p.displayName) : undefined,
          config: p.config && typeof p.config === 'object'
            ? Object.fromEntries(
                Object.entries(p.config).map(([k, v]) => [k, String(v)])
              )
            : undefined,
        }))
      : [];

    // Authentication Flows конфигурация
    const authenticationFlows: KeycloakAuthenticationFlow[] = Array.isArray(raw.authenticationFlows)
      ? raw.authenticationFlows.map((f: any) => ({
          id: String(f.id ?? `flow-${Date.now()}`),
          alias: String(f.alias ?? 'flow'),
          description: f.description ? String(f.description) : undefined,
          providerId: String(f.providerId ?? 'basic-flow'),
          topLevel: f.topLevel ?? false,
          builtIn: f.builtIn ?? false,
          executions: Array.isArray(f.executions)
            ? f.executions.map((e: any) => ({
                id: String(e.id ?? `exec-${Date.now()}`),
                requirement: (e.requirement ?? 'REQUIRED') as 'REQUIRED' | 'ALTERNATIVE' | 'DISABLED' | 'CONDITIONAL',
                displayName: String(e.displayName ?? e.providerId ?? 'execution'),
                configurable: e.configurable ?? false,
                providerId: String(e.providerId ?? 'basic-auth'),
              }))
            : undefined,
        }))
      : [];

    this.config = {
      realm: String(raw.realm || 'archiphoenix'),
      adminUrl: String(raw.adminUrl || 'http://keycloak:8080'),
      enableSSL: raw.enableSSL ?? false,
      sslRequired: (raw.sslRequired || 'external') as 'external' | 'all' | 'none',
      accessTokenLifespan: Number(raw.accessTokenLifespan || 300),
      refreshTokenLifespan: Number(raw.refreshTokenLifespan || raw.refreshTokenLifespan || 1800),
      ssoSessionIdle: Number(raw.ssoSessionIdle || 1800),
      ssoSessionMax: Number(raw.ssoSessionMax || 36000),
      enableOAuth2: raw.enableOAuth2 ?? true,
      enableSAML: raw.enableSAML ?? false,
      enableLDAP: raw.enableLDAP ?? false,
      passwordPolicy: String(raw.passwordPolicy || 'length(8)'),
      clients,
      users,
      clientScopes,
      email: emailConfig,
      events: eventsConfig,
      identityProviders: identityProviders.length > 0 ? identityProviders : undefined,
      authenticationFlows: authenticationFlows.length > 0 ? authenticationFlows : undefined,
    };
  }

  /**
   * Валидация grant type для клиента
   */
  private validateClientGrantType(
    client: KeycloakClient,
    grantType: 'authorization_code' | 'implicit' | 'client_credentials' | 'password' | 'refresh_token'
  ): boolean {
    switch (grantType) {
      case 'authorization_code':
        return client.standardFlowEnabled !== false;
      case 'implicit':
        return client.implicitFlowEnabled === true;
      case 'client_credentials':
        return client.serviceAccountsEnabled === true;
      case 'password':
        return client.directAccessGrantsEnabled !== false;
      case 'refresh_token':
        return true; // Refresh token всегда доступен если есть access token
      default:
        return false;
    }
  }

  /**
   * Валидация redirect URI
   */
  private validateRedirectUri(client: KeycloakClient, redirectUri: string): boolean {
    if (!redirectUri) return false;
    const allowedUris = client.redirectUris || [];
    if (allowedUris.length === 0) return true; // Если не указаны, разрешаем любой
    return allowedUris.some(uri => {
      // Простая проверка: точное совпадение или wildcard
      if (uri === redirectUri) return true;
      if (uri.endsWith('*')) {
        const prefix = uri.slice(0, -1);
        return redirectUri.startsWith(prefix);
      }
      return false;
    });
  }

  /**
   * Генерация токена с учетом scopes и mappers
   */
  private generateToken(
    config: KeycloakEmulationConfig,
    client: KeycloakClient,
    user: KeycloakUser | undefined,
    scopes: string[] = []
  ): { accessToken: string; refreshToken?: string; idToken?: string; claims: Record<string, any> } {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = config.accessTokenLifespan;
    const refreshExpiresIn = config.refreshTokenLifespan || 1800;

    // Базовые claims
    const claims: Record<string, any> = {
      iss: `${config.adminUrl}/realms/${config.realm}`,
      aud: client.clientId || client.id,
      exp: now + expiresIn,
      iat: now,
      jti: `token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    // Добавляем subject если есть пользователь
    if (user) {
      claims.sub = user.id;
      claims.preferred_username = user.username;
      if (user.email) claims.email = user.email;
    }

    // Применяем client scopes
    const allScopes = [
      ...(client.defaultClientScopes || []),
      ...(client.optionalClientScopes || []),
      ...scopes,
    ];

    // Применяем protocol mappers из scopes
    if (config.clientScopes) {
      for (const scopeName of allScopes) {
        const scope = config.clientScopes.find(s => s.name === scopeName);
        if (scope?.protocolMappers) {
          for (const mapper of scope.protocolMappers) {
            this.applyProtocolMapper(mapper, claims, user, client);
          }
        }
      }
    }

    // Добавляем roles и groups если есть пользователь
    if (user) {
      if (user.realmRoles && user.realmRoles.length > 0) {
        claims.realm_access = { roles: user.realmRoles };
      }
      if (user.clientRoles && Object.keys(user.clientRoles).length > 0) {
        claims.resource_access = {};
        for (const [clientId, roles] of Object.entries(user.clientRoles)) {
          if (roles.length > 0) {
            claims.resource_access[clientId] = { roles };
          }
        }
      }
      if (user.groups && user.groups.length > 0) {
        claims.groups = user.groups;
      }
    }

    // Генерируем токены (упрощенная версия - в реальности это JWT)
    const accessToken = `access_token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const refreshToken = user ? `refresh_token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` : undefined;
    const idToken = user ? `id_token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` : undefined;

    return { accessToken, refreshToken, idToken, claims };
  }

  /**
   * Применение protocol mapper к claims
   */
  private applyProtocolMapper(
    mapper: ProtocolMapper,
    claims: Record<string, any>,
    user: KeycloakUser | undefined,
    client: KeycloakClient
  ): void {
    const mapperType = mapper.protocolMapper;
    const config = mapper.config;

    if (mapperType.includes('usermodel-property')) {
      const userAttribute = config.userAttribute || config.user.attribute || 'username';
      const claimName = config.claimName || config.claim || userAttribute;
      if (user) {
        if (userAttribute === 'username') {
          claims[claimName] = user.username;
        } else if (userAttribute === 'email') {
          claims[claimName] = user.email;
        }
      }
    } else if (mapperType.includes('user-realm-role')) {
      const claimName = config.claimName || 'realm_access.roles';
      if (user?.realmRoles) {
        if (claimName.includes('.')) {
          const [parent, child] = claimName.split('.');
          if (!claims[parent]) claims[parent] = {};
          claims[parent][child] = user.realmRoles;
        } else {
          claims[claimName] = user.realmRoles;
        }
      }
    } else if (mapperType.includes('user-client-role')) {
      const claimName = config.claimName || 'resource_access';
      const clientId = config.clientId || client.id;
      if (user?.clientRoles?.[clientId]) {
        if (!claims[claimName]) claims[claimName] = {};
        claims[claimName][clientId] = { roles: user.clientRoles[clientId] };
      }
    } else if (mapperType.includes('user-group-membership')) {
      const claimName = config.claimName || 'groups';
      if (user?.groups) {
        claims[claimName] = user.groups;
      }
    }
  }

  /**
   * Authorization Code Flow
   */
  private processAuthorizationCodeFlow(
    request: KeycloakOAuth2Request,
    config: KeycloakEmulationConfig,
    client: KeycloakClient
  ): KeycloakOAuth2Response | null {
    // Валидация grant type
    if (!this.validateClientGrantType(client, 'authorization_code')) {
      return null;
    }

    // Валидация redirect URI
    if (request.redirectUri && !this.validateRedirectUri(client, request.redirectUri)) {
      return null;
    }

    // Валидация authorization code (упрощенно - в реальности проверяется в базе)
    if (!request.code) {
      return null;
    }

    // Находим пользователя по коду (упрощенно)
    const user = config.users.find(u => u.enabled);
    if (!user) {
      return null;
    }

    // Генерируем токены
    const scopes = request.scope || [];
    const tokens = this.generateToken(config, client, user, scopes);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenLifespan,
      refreshExpiresIn: config.refreshTokenLifespan || 1800,
      scope: scopes.join(' '),
    };
  }

  /**
   * Implicit Flow
   */
  private processImplicitFlow(
    request: KeycloakOAuth2Request,
    config: KeycloakEmulationConfig,
    client: KeycloakClient
  ): KeycloakOAuth2Response | null {
    if (!this.validateClientGrantType(client, 'implicit')) {
      return null;
    }

    if (request.redirectUri && !this.validateRedirectUri(client, request.redirectUri)) {
      return null;
    }

    const user = config.users.find(u => u.enabled);
    if (!user) {
      return null;
    }

    const scopes = request.scope || [];
    const tokens = this.generateToken(config, client, user, scopes);

    return {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenLifespan,
      scope: scopes.join(' '),
    };
  }

  /**
   * Client Credentials Flow
   */
  private processClientCredentialsFlow(
    request: KeycloakOAuth2Request,
    config: KeycloakEmulationConfig,
    client: KeycloakClient
  ): KeycloakOAuth2Response | null {
    if (!this.validateClientGrantType(client, 'client_credentials')) {
      return null;
    }

    // Проверка client secret для confidential clients
    if (client.type === 'confidential' && client.clientSecret) {
      if (request.clientSecret !== client.clientSecret) {
        return null;
      }
    }

    // Client credentials flow не использует пользователя
    const scopes = request.scope || [];
    const tokens = this.generateToken(config, client, undefined, scopes);

    return {
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenLifespan,
      scope: scopes.join(' '),
    };
  }

  /**
   * Password Flow (Resource Owner Password Credentials)
   */
  private processPasswordFlow(
    request: KeycloakOAuth2Request,
    config: KeycloakEmulationConfig,
    client: KeycloakClient
  ): KeycloakOAuth2Response | null {
    if (!this.validateClientGrantType(client, 'password')) {
      return null;
    }

    if (!request.username || !request.password) {
      return null;
    }

    const user = config.users.find(u => u.username === request.username && u.enabled);
    if (!user) {
      return null;
    }

    // В реальности здесь проверяется пароль, но в симуляции просто проверяем что пользователь существует
    const scopes = request.scope || [];
    const tokens = this.generateToken(config, client, user, scopes);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenLifespan,
      refreshExpiresIn: config.refreshTokenLifespan || 1800,
      scope: scopes.join(' '),
    };
  }

  /**
   * Refresh Token Flow
   */
  private processRefreshTokenFlow(
    request: KeycloakOAuth2Request,
    config: KeycloakEmulationConfig,
    client: KeycloakClient
  ): KeycloakOAuth2Response | null {
    if (!this.validateClientGrantType(client, 'refresh_token')) {
      return null;
    }

    if (!request.refreshToken) {
      return null;
    }

    // В реальности здесь проверяется refresh token в базе
    // В симуляции просто находим пользователя
    const user = config.users.find(u => u.enabled);
    if (!user) {
      return null;
    }

    const scopes = request.scope || [];
    const tokens = this.generateToken(config, client, user, scopes);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenLifespan,
      refreshExpiresIn: config.refreshTokenLifespan || 1800,
      scope: scopes.join(' '),
    };
  }

  /**
   * Обработать OAuth2/OIDC запрос
   */
  public processOAuth2Request(request: KeycloakOAuth2Request): KeycloakOAuth2Response | null {
    const config = this.config;
    if (!config || !config.enableOAuth2) {
      return null;
    }

    const client = config.clients.find(
      c => (c.clientId || c.id) === request.clientId && c.enabled
    );

    if (!client) {
      return null;
    }

    let response: KeycloakOAuth2Response | null = null;

    switch (request.grantType) {
      case 'authorization_code':
        response = this.processAuthorizationCodeFlow(request, config, client);
        if (response) {
          this.trackEvent('LOGIN', { clientId: request.clientId, realm: config.realm, flow: 'authorization_code' });
        }
        break;
      case 'implicit':
        response = this.processImplicitFlow(request, config, client);
        if (response) {
          this.trackEvent('LOGIN', { clientId: request.clientId, realm: config.realm, flow: 'implicit' });
        }
        break;
      case 'client_credentials':
        response = this.processClientCredentialsFlow(request, config, client);
        if (response) {
          this.trackEvent('LOGIN', { clientId: request.clientId, realm: config.realm, flow: 'client_credentials' });
        }
        break;
      case 'password':
        response = this.processPasswordFlow(request, config, client);
        if (response) {
          this.trackEvent('LOGIN', { 
            clientId: request.clientId, 
            realm: config.realm, 
            flow: 'password',
            username: request.username 
          });
        } else {
          this.trackEvent('LOGIN_ERROR', { 
            clientId: request.clientId, 
            realm: config.realm, 
            flow: 'password',
            username: request.username 
          });
        }
        break;
      case 'refresh_token':
        response = this.processRefreshTokenFlow(request, config, client);
        if (response) {
          this.trackEvent('TOKEN_REFRESH', { clientId: request.clientId, realm: config.realm });
        }
        break;
    }

    return response;
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
      grant_type?: string;
      redirectUri?: string;
      redirect_uri?: string;
      code?: string;
      password?: string;
      refreshToken?: string;
      refresh_token?: string;
      scope?: string | string[];
      clientSecret?: string;
      client_secret?: string;
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

    // Если указан grant_type, пытаемся обработать как OAuth2 запрос
    const grantType = payload.grantType || payload.grant_type;
    if (grantType && config.enableOAuth2) {
      const oauth2Request: KeycloakOAuth2Request = {
        grantType: grantType as any,
        clientId: payload.clientId || this.inferDefaultClientId(),
        clientSecret: payload.clientSecret || payload.client_secret,
        redirectUri: payload.redirectUri || payload.redirect_uri,
        code: payload.code,
        username: payload.username,
        password: payload.password,
        refreshToken: payload.refreshToken || payload.refresh_token,
        scope: Array.isArray(payload.scope) 
          ? payload.scope 
          : typeof payload.scope === 'string' 
            ? payload.scope.split(' ').filter(s => s.length > 0)
            : [],
      };

      const oauth2Response = this.processOAuth2Request(oauth2Request);
      if (oauth2Response) {
        const latency = this.calculateOAuth2Latency(grantType as any, config);
        this.recordLatency(latency);
        this.updateMetricsForGrantType(grantType as any);
        return {
          success: true,
          latency,
          tokenType: 'access',
          expiresIn: oauth2Response.expiresIn,
          subject: payload.username || payload.subject,
          clientId: oauth2Request.clientId,
          realm: config.realm,
          accessToken: oauth2Response.accessToken,
          refreshToken: oauth2Response.refreshToken,
          idToken: oauth2Response.idToken,
        };
      } else {
        const latency = 50;
        this.recordLatency(latency);
        this.metrics.loginErrorsTotal++;
        return {
          success: false,
          latency,
          error: `OAuth2 ${grantType} flow failed`,
          clientId: oauth2Request.clientId,
          realm: config.realm,
        };
      }
    }

    const clientId = payload.clientId || this.inferDefaultClientId();
    const client = config.clients.find((c) => (c.clientId || c.id) === clientId && c.enabled);

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

    // Учитываем LDAP, если включен (увеличиваем latency)
    if (config.enableLDAP) {
      baseLatency *= 1.3;
      // Дополнительная latency для LDAP connection pool и синхронизации
      baseLatency += 20;
    }

    // Учитываем SAML, если включен
    if (config.enableSAML && type === 'login') {
      baseLatency *= 1.2;
      baseLatency += 30; // SAML processing overhead
    }

    // Лёгкий jitter
    const jitter = (Math.random() - 0.5) * 20;
    const latency = Math.max(10, baseLatency + jitter);
    this.recordLatency(latency);

    // Проверяем клиента
    if (!client) {
      this.metrics.loginErrorsTotal++;
      this.bumpCounter(type);
      this.trackEvent('LOGIN_ERROR', { 
        clientId, 
        realm: config.realm,
        reason: 'client_not_found_or_disabled'
      });
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
        this.trackEvent('LOGIN_ERROR', { 
          username: username || 'unknown', 
          clientId, 
          realm: config.realm,
          reason: !user ? 'user_not_found' : 'user_disabled'
        });
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
        this.trackEvent('LOGIN', { username: user!.username, clientId, realm: config.realm });
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
        this.trackEvent('TOKEN_REFRESH', { subject: payload.subject, clientId, realm: config.realm });
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

  /**
   * Расчет latency для OAuth2 flow
   */
  private calculateOAuth2Latency(
    grantType: 'authorization_code' | 'implicit' | 'client_credentials' | 'password' | 'refresh_token',
    config: KeycloakEmulationConfig
  ): number {
    let baseLatency = 60; // Базовая latency

    switch (grantType) {
      case 'authorization_code':
        baseLatency = 100; // Самый сложный flow
        break;
      case 'implicit':
        baseLatency = 80;
        break;
      case 'client_credentials':
        baseLatency = 50; // Самый простой
        break;
      case 'password':
        baseLatency = 90;
        if (config.passwordPolicy) {
          baseLatency += this.estimatePasswordPolicyCost(config.passwordPolicy);
        }
        break;
      case 'refresh_token':
        baseLatency = 40;
        break;
    }

    // Учитываем LDAP (если включен глобально или через identity provider)
    const hasLDAP = config.enableLDAP || (config.identityProviders?.some(p => p.enabled && p.providerId === 'ldap') ?? false);
    if (hasLDAP) {
      baseLatency *= 1.3;
      baseLatency += 20; // LDAP connection pool overhead
    }

    // Учитываем SAML (если включен глобально или через identity provider)
    const hasSAML = config.enableSAML || (config.identityProviders?.some(p => p.enabled && p.providerId === 'saml') ?? false);
    if (hasSAML) {
      baseLatency *= 1.2;
      baseLatency += 30; // SAML processing overhead
    }

    // Учитываем Social Providers (Google, GitHub, Facebook) - внешние вызовы
    const socialProviders = config.identityProviders?.filter(p => 
      p.enabled && (p.providerId === 'google' || p.providerId === 'github' || p.providerId === 'facebook')
    ) ?? [];
    if (socialProviders.length > 0) {
      // Каждый social provider добавляет latency для внешнего вызова
      // Симуляция redirect flow и обмена токенами с внешним провайдером
      baseLatency += socialProviders.length * 50; // 50ms на каждый social provider для внешнего вызова
      baseLatency += 30; // Overhead для обработки redirect flow
    }

    // Учитываем Authentication Flows - дополнительные executions увеличивают latency
    if (config.authenticationFlows && config.authenticationFlows.length > 0) {
      // Находим активные flows (не built-in или кастомные)
      const activeFlows = config.authenticationFlows.filter(f => !f.builtIn || f.topLevel);
      for (const flow of activeFlows) {
        if (flow.executions && flow.executions.length > 0) {
          // Каждый execution добавляет latency (только REQUIRED и CONDITIONAL)
          const requiredExecutions = flow.executions.filter(e => 
            e.requirement === 'REQUIRED' || e.requirement === 'CONDITIONAL'
          );
          baseLatency += requiredExecutions.length * 10; // 10ms на каждый execution
        }
      }
    }

    // Учитываем events overhead
    if (config.events?.enabled || config.events?.eventsEnabled) {
      baseLatency += 2; // Events storage overhead
    }
    if (config.events?.adminEventsEnabled) {
      baseLatency += 5; // Admin events overhead
    }

    // Jitter
    const jitter = (Math.random() - 0.5) * 20;
    return Math.max(10, baseLatency + jitter);
  }

  /**
   * Обновление метрик для grant type
   */
  private updateMetricsForGrantType(
    grantType: 'authorization_code' | 'implicit' | 'client_credentials' | 'password' | 'refresh_token'
  ): void {
    switch (grantType) {
      case 'authorization_code':
      case 'implicit':
      case 'password':
        this.metrics.loginRequestsTotal++;
        break;
      case 'refresh_token':
        this.metrics.tokenRefreshTotal++;
        break;
      case 'client_credentials':
        this.metrics.loginRequestsTotal++;
        break;
    }
  }

  /**
   * Симуляция отправки email (password reset, verification, etc.)
   * Учитывает SMTP latency и конфигурацию email сервера
   */
  private simulateEmailOperation(operation: 'password_reset' | 'email_verification' | 'other'): {
    success: boolean;
    latency: number;
  } {
    const config = this.config;
    if (!config?.email?.host) {
      // Email не настроен - операция не может быть выполнена
      this.metrics.emailErrorsTotal++;
      return { success: false, latency: 10 };
    }

    // Базовая SMTP latency (50-200ms в зависимости от конфигурации)
    let smtpLatency = 50;
    
    // Увеличение latency при использовании SSL/TLS
    if (config.email.enableSsl || config.email.enableStartTls) {
      smtpLatency += 30; // TLS handshake overhead
    }
    
    // Увеличение latency при аутентификации
    if (config.email.enableAuthentication) {
      smtpLatency += 20; // Authentication overhead
    }
    
    // Дополнительная latency для разных операций
    switch (operation) {
      case 'password_reset':
        smtpLatency += 40; // Генерация токена сброса пароля
        break;
      case 'email_verification':
        smtpLatency += 30; // Генерация токена верификации
        break;
      default:
        smtpLatency += 20;
    }
    
    // Jitter для реалистичности
    const jitter = (Math.random() - 0.5) * 30;
    const totalLatency = Math.max(20, smtpLatency + jitter);
    
    // Симуляция ошибок (1-5% в зависимости от конфигурации)
    const errorRate = config.email.enableAuthentication ? 0.02 : 0.01;
    const success = Math.random() > errorRate;
    
    if (success) {
      this.metrics.emailsSentTotal++;
    } else {
      this.metrics.emailErrorsTotal++;
    }
    
    // Учет latency для email операций
    this.recordLatency(totalLatency);
    
    return { success, latency: totalLatency };
  }

  /**
   * Отслеживание событий с учетом events config
   */
  private trackEvent(
    eventType: 'LOGIN' | 'LOGIN_ERROR' | 'LOGOUT' | 'TOKEN_REFRESH' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'ADMIN',
    details?: Record<string, any>
  ): void {
    const config = this.config;
    if (!config?.events) {
      return; // Events не настроены
    }

    // Проверка включенности events
    if (!config.events.enabled && !config.events.eventsEnabled) {
      return;
    }

    // Проверка для admin events
    if (eventType === 'ADMIN' && !config.events.adminEventsEnabled) {
      return;
    }

    // Учет overhead для хранения событий (увеличивает latency)
    const eventsOverhead = config.events.eventsEnabled ? 2 : 0;
    const adminEventsOverhead = config.events.adminEventsEnabled && eventType === 'ADMIN' ? 5 : 0;
    const totalOverhead = eventsOverhead + adminEventsOverhead;

    if (totalOverhead > 0) {
      this.recordLatency(totalOverhead);
    }

    // Обновление метрик
    this.metrics.eventsTotal++;
    if (eventType === 'ADMIN') {
      this.metrics.adminEventsTotal++;
    }

    // В реальном Keycloak события сохраняются в БД, но для симуляции достаточно метрик
  }

  /**
   * Обработка password reset запроса
   */
  public processPasswordReset(username: string): KeycloakAuthResult {
    const config = this.config;
    if (!config) {
      return {
        success: false,
        latency: 50,
        error: 'Keycloak not configured',
      };
    }

    const user = config.users.find(u => u.username === username && u.enabled);
    if (!user) {
      this.trackEvent('LOGIN_ERROR', { username, reason: 'user_not_found' });
      return {
        success: false,
        latency: 30,
        error: `User ${username} not found or disabled`,
      };
    }

    // Симуляция отправки email для password reset
    const emailResult = this.simulateEmailOperation('password_reset');
    this.trackEvent('PASSWORD_RESET', { username, emailSuccess: emailResult.success });

    if (!emailResult.success) {
      return {
        success: false,
        latency: emailResult.latency,
        error: 'Failed to send password reset email',
      };
    }

    return {
      success: true,
      latency: emailResult.latency,
      subject: username,
      realm: config.realm,
    };
  }

  /**
   * Обработка email verification запроса
   */
  public processEmailVerification(username: string): KeycloakAuthResult {
    const config = this.config;
    if (!config) {
      return {
        success: false,
        latency: 50,
        error: 'Keycloak not configured',
      };
    }

    const user = config.users.find(u => u.username === username && u.enabled);
    if (!user) {
      this.trackEvent('LOGIN_ERROR', { username, reason: 'user_not_found' });
      return {
        success: false,
        latency: 30,
        error: `User ${username} not found or disabled`,
      };
    }

    // Симуляция отправки email для verification
    const emailResult = this.simulateEmailOperation('email_verification');
    this.trackEvent('EMAIL_VERIFICATION', { username, emailSuccess: emailResult.success });

    if (!emailResult.success) {
      return {
        success: false,
        latency: emailResult.latency,
        error: 'Failed to send verification email',
      };
    }

    return {
      success: true,
      latency: emailResult.latency,
      subject: username,
      realm: config.realm,
    };
  }
}


