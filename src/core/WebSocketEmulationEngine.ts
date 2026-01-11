import { CanvasNode, CanvasConnection } from '@/types';
import { DataMessage } from './DataFlowEngine';

/**
 * WebSocket Connection
 */
export interface WebSocketConnection {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectedAt?: number;
  disconnectedAt?: number;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  lastMessageAt?: number;
  lastPingAt?: number;
  lastPongAt?: number;
  roomId?: string;
  subscriptions: string[]; // Subscription IDs
  clientIP?: string;
  userAgent?: string;
  authenticated: boolean;
  authMethod?: 'none' | 'token' | 'apiKey' | 'basic';
  error?: string;
  latency?: number; // Average latency for this connection
}

/**
 * WebSocket Room
 */
export interface WebSocketRoom {
  id: string;
  name: string;
  connections: string[]; // Connection IDs
  messagesBroadcast: number;
  createdAt: number;
  description?: string;
}

/**
 * WebSocket Subscription
 */
export interface WebSocketSubscription {
  id: string;
  topic: string;
  connections: string[]; // Connection IDs subscribed to this topic
  messagesDelivered: number;
  createdAt: number;
  enabled: boolean;
}

/**
 * WebSocket Message
 */
export interface WebSocketMessage {
  id: string;
  connectionId: string;
  type: 'text' | 'binary' | 'ping' | 'pong' | 'close';
  content: string | ArrayBuffer;
  timestamp: number;
  direction: 'sent' | 'received';
  roomId?: string;
  subscriptionId?: string;
  size: number; // bytes
  compressed?: boolean;
  latency?: number; // ms
  error?: string;
}

/**
 * WebSocket Configuration
 */
export interface WebSocketConfig {
  endpoint?: string;
  protocol?: 'ws' | 'wss';
  connections?: WebSocketConnection[];
  rooms?: WebSocketRoom[];
  subscriptions?: WebSocketSubscription[];
  messages?: WebSocketMessage[];
  totalConnections?: number;
  activeConnections?: number;
  totalMessages?: number;
  enableCompression?: boolean;
  enablePingPong?: boolean;
  pingInterval?: number; // seconds
  maxConnections?: number;
  maxMessageSize?: number; // KB
  authentication?: {
    enabled: boolean;
    method: 'none' | 'token' | 'apiKey' | 'basic';
    token?: string;
    apiKey?: string;
  };
  rateLimit?: {
    enabled: boolean;
    messagesPerSecond?: number;
    connectionsPerSecond?: number;
  };
  roomsEnabled?: boolean;
  subscriptionsEnabled?: boolean;
}

/**
 * WebSocket Metrics
 */
export interface WebSocketMetrics {
  connectionsTotal: number;
  connectionsActive: number;
  connectionsPerSecond: number;
  messagesPerSecond: number;
  messagesTotal: number;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  averageLatency: number;
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  errorRate: number;
  connectionErrorRate: number;
  pingPongSuccessRate: number;
  compressionRatio: number;
  roomsCount: number;
  subscriptionsCount: number;
  averageConnectionsPerRoom: number;
  averageSubscriptionsPerConnection: number;
  utilization: number;
}

/**
 * Connection Metrics
 */
export interface ConnectionMetrics {
  connectionId: string;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  averageLatency: number;
  uptime: number; // seconds
  lastActivity: number;
}

/**
 * Room Metrics
 */
export interface RoomMetrics {
  roomId: string;
  connectionsCount: number;
  messagesBroadcast: number;
  averageLatency: number;
}

/**
 * Subscription Metrics
 */
export interface SubscriptionMetrics {
  subscriptionId: string;
  connectionsCount: number;
  messagesDelivered: number;
  averageLatency: number;
}

/**
 * WebSocket Emulation Engine
 * Симулирует работу WebSocket сервера: управление соединениями, комнатами, подписками, метрики
 */
export class WebSocketEmulationEngine {
  private config: WebSocketConfig | null = null;
  
  // Метрики WebSocket
  private wsMetrics: WebSocketMetrics = {
    connectionsTotal: 0,
    connectionsActive: 0,
    connectionsPerSecond: 0,
    messagesPerSecond: 0,
    messagesTotal: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    averageLatency: 0,
    errorRate: 0,
    connectionErrorRate: 0,
    pingPongSuccessRate: 1.0,
    compressionRatio: 0.5,
    roomsCount: 0,
    subscriptionsCount: 0,
    averageConnectionsPerRoom: 0,
    averageSubscriptionsPerConnection: 0,
    utilization: 0,
  };
  
  // Активные соединения
  private connections: Map<string, WebSocketConnection> = new Map();
  
  // Комнаты
  private rooms: Map<string, WebSocketRoom> = new Map();
  
  // Подписки
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  
  // История сообщений
  private messageHistory: WebSocketMessage[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // История latency для расчета перцентилей
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 500;
  
  // Временные метки для расчета RPS
  private lastSecondStart: number = Date.now();
  private connectionsThisSecond: number = 0;
  private messagesThisSecond: number = 0;
  
  // Rate limiting tracking
  private rateLimitWindowStart: number = Date.now();
  private rateLimitConnectionsInWindow: number = 0;
  private rateLimitMessagesInWindow: number = 0;
  
  // Метрики соединений
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  
  // Метрики комнат
  private roomMetrics: Map<string, RoomMetrics> = new Map();
  
  // Метрики подписок
  private subscriptionMetrics: Map<string, SubscriptionMetrics> = new Map();
  
  // ID WebSocket компонента
  private componentId: string | null = null;
  
  // Функция для отправки сообщений к целевым компонентам
  private sendMessageToTarget?: (
    sourceId: string,
    targetId: string,
    message: DataMessage
  ) => Promise<DataMessage | null>;
  
  // Симуляция входящих соединений и сообщений
  private simulatedConnectionRate: number = 0;
  private simulatedMessageRate: number = 0;
  private lastSimulationTime: number = Date.now();
  
  // Ping/Pong tracking
  private pingPongHistory: Array<{ timestamp: number; success: boolean }> = [];
  private readonly MAX_PING_PONG_HISTORY = 100;
  
  /**
   * Инициализация конфигурации из узла WebSocket
   */
  public initialize(node: CanvasNode, sendMessageToTarget?: (
    sourceId: string,
    targetId: string,
    message: DataMessage
  ) => Promise<DataMessage | null>): void {
    this.componentId = node.id;
    this.sendMessageToTarget = sendMessageToTarget;
    
    const config = (node.data.config || {}) as WebSocketConfig;
    this.config = {
      endpoint: config.endpoint || 'ws://localhost:8080/ws',
      protocol: config.protocol || 'ws',
      enableCompression: config.enableCompression ?? true,
      enablePingPong: config.enablePingPong ?? true,
      pingInterval: config.pingInterval || 30,
      maxConnections: config.maxConnections || 1000,
      maxMessageSize: config.maxMessageSize || 1024,
      roomsEnabled: config.roomsEnabled ?? true,
      subscriptionsEnabled: config.subscriptionsEnabled ?? true,
      authentication: config.authentication || {
        enabled: false,
        method: 'none',
      },
      rateLimit: config.rateLimit || {
        enabled: false,
        messagesPerSecond: 1000,
        connectionsPerSecond: 100,
      },
      ...config,
    };
    
    // Восстановить соединения из конфига
    if (config.connections) {
      for (const conn of config.connections) {
        if (conn.status === 'connected') {
          this.connections.set(conn.id, { ...conn });
        }
      }
    }
    
    // Восстановить комнаты из конфига
    if (config.rooms) {
      for (const room of config.rooms) {
        this.rooms.set(room.id, { ...room });
      }
    }
    
    // Восстановить подписки из конфига
    if (config.subscriptions) {
      for (const sub of config.subscriptions) {
        if (sub.enabled) {
          this.subscriptions.set(sub.id, { ...sub });
        }
      }
    }
    
    // Восстановить историю сообщений (ограниченную)
    if (config.messages) {
      this.messageHistory = config.messages.slice(-this.MAX_HISTORY_SIZE);
    }
  }
  
  /**
   * Обновление метрик на основе входящих соединений и сообщений
   */
  public updateMetrics(hasIncomingConnections: boolean, simulationTime: number): void {
    if (!this.config) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastSimulationTime) / 1000; // seconds
    
    if (!hasIncomingConnections) {
      // Нет входящих соединений - постепенно уменьшаем активность
      this.simulatedConnectionRate = Math.max(0, this.simulatedConnectionRate * 0.95);
      this.simulatedMessageRate = Math.max(0, this.simulatedMessageRate * 0.95);
      
      // Закрываем соединения со временем
      this.closeIdleConnections();
      
      this.lastSimulationTime = now;
      this.calculateMetrics();
      return;
    }
    
    // Симуляция новых соединений
    if (deltaTime > 0) {
      const targetConnectionRate = this.simulatedConnectionRate || 5; // connections per second
      const connectionsToAdd = Math.floor(targetConnectionRate * deltaTime);
      
      for (let i = 0; i < connectionsToAdd; i++) {
        if (this.connections.size < (this.config.maxConnections || 1000)) {
          this.simulateNewConnection();
        }
      }
      
      // Симуляция сообщений от активных соединений
      const activeConnections = Array.from(this.connections.values()).filter(
        c => c.status === 'connected'
      );
      
      const targetMessageRate = this.simulatedMessageRate || 50; // messages per second
      const messagesPerConnection = targetMessageRate / Math.max(1, activeConnections.length);
      const messagesToAdd = Math.floor(messagesPerConnection * activeConnections.length * deltaTime);
      
      for (let i = 0; i < messagesToAdd && i < activeConnections.length * 10; i++) {
        const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        if (conn) {
          this.simulateMessage(conn.id, 'received');
        }
      }
    }
    
    // Обработка ping/pong
    if (this.config.enablePingPong) {
      this.processPingPong();
    }
    
    // Обновление метрик соединений
    this.updateConnectionMetrics();
    
    // Обновление метрик комнат
    this.updateRoomMetrics();
    
    // Обновление метрик подписок
    this.updateSubscriptionMetrics();
    
    // Расчет общих метрик
    this.calculateMetrics();
    
    this.lastSimulationTime = now;
  }
  
  /**
   * Создание соединения вручную (для тест-клиента)
   */
  public createConnection(connectionId: string, metadata?: {
    clientIP?: string;
    userAgent?: string;
    roomId?: string;
    subscriptions?: string[];
  }): boolean {
    if (!this.config) return false;
    
    // Проверка лимита соединений
    if (this.connections.size >= (this.config.maxConnections || 1000)) {
      return false;
    }
    
    // Проверка аутентификации
    if (this.config.authentication?.enabled) {
      const authenticated = this.authenticateConnection();
      if (!authenticated) {
        return false;
      }
    }
    
    const now = Date.now();
    const connection: WebSocketConnection = {
      id: connectionId,
      status: 'connected',
      connectedAt: now,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      lastMessageAt: now,
      subscriptions: metadata?.subscriptions || [],
      authenticated: true,
      authMethod: this.config.authentication?.method || 'none',
      latency: 10 + Math.random() * 20,
      clientIP: metadata?.clientIP,
      userAgent: metadata?.userAgent,
      roomId: metadata?.roomId,
    };
    
    this.connections.set(connectionId, connection);
    this.wsMetrics.connectionsTotal++;
    this.connectionsThisSecond++;
    
    // Добавление в комнату (если указана)
    if (metadata?.roomId && this.config.roomsEnabled) {
      const room = this.rooms.get(metadata.roomId);
      if (room && !room.connections.includes(connectionId)) {
        room.connections.push(connectionId);
      }
    }
    
    // Подписка на топики (если указаны)
    if (metadata?.subscriptions && this.config.subscriptionsEnabled) {
      for (const subId of metadata.subscriptions) {
        const sub = this.subscriptions.get(subId);
        if (sub && sub.enabled && !sub.connections.includes(connectionId)) {
          sub.connections.push(connectionId);
        }
      }
    }
    
    return true;
  }
  
  /**
   * Закрытие соединения вручную (для тест-клиента)
   */
  public closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = 'disconnected';
      connection.disconnectedAt = Date.now();
      
      // Удаление из комнат
      if (connection.roomId) {
        const room = this.rooms.get(connection.roomId);
        if (room) {
          room.connections = room.connections.filter(id => id !== connectionId);
        }
      }
      
      // Удаление из подписок
      for (const subId of connection.subscriptions) {
        const sub = this.subscriptions.get(subId);
        if (sub) {
          sub.connections = sub.connections.filter(id => id !== connectionId);
        }
      }
    }
  }
  
  /**
   * Симуляция нового соединения
   */
  private simulateNewConnection(): void {
    if (!this.config) return;
    
    const now = Date.now();
    
    // Проверка rate limiting для соединений
    if (this.config.rateLimit?.enabled) {
      const windowDuration = 1000; // 1 second window
      const elapsed = now - this.rateLimitWindowStart;
      
      // Сброс окна если прошла секунда
      if (elapsed >= windowDuration) {
        this.rateLimitWindowStart = now;
        this.rateLimitConnectionsInWindow = 0;
        this.rateLimitMessagesInWindow = 0;
      }
      
      const maxConnectionsPerSecond = this.config.rateLimit.connectionsPerSecond || 100;
      if (this.rateLimitConnectionsInWindow >= maxConnectionsPerSecond) {
        // Rate limit exceeded - reject connection
        this.wsMetrics.connectionsTotal++;
        this.wsMetrics.connectionErrorRate = 
          (this.wsMetrics.connectionErrorRate * 0.9) + (0.1 * 1.0);
        return;
      }
      
      this.rateLimitConnectionsInWindow++;
    }
    
    const connectionId = `ws-conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Проверка аутентификации
    let authenticated = true;
    let authError: string | undefined;
    
    if (this.config.authentication?.enabled) {
      authenticated = this.authenticateConnection();
      if (!authenticated) {
        authError = 'Authentication failed';
      }
    }
    
    if (!authenticated) {
      // Неудачное соединение
      this.wsMetrics.connectionsTotal++;
      this.wsMetrics.connectionErrorRate = 
        (this.wsMetrics.connectionErrorRate * 0.9) + (0.1 * 1.0);
      return;
    }
    
    // Создание соединения
    const connection: WebSocketConnection = {
      id: connectionId,
      status: 'connected',
      connectedAt: now,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      lastMessageAt: now,
      subscriptions: [],
      authenticated: true,
      authMethod: this.config.authentication?.method || 'none',
      latency: 10 + Math.random() * 20, // 10-30ms
    };
    
    this.connections.set(connectionId, connection);
    this.wsMetrics.connectionsTotal++;
    this.connectionsThisSecond++;
    
    // Добавление в комнату (если включены комнаты)
    if (this.config.roomsEnabled && this.rooms.size > 0) {
      const roomIds = Array.from(this.rooms.keys());
      const randomRoomId = roomIds[Math.floor(Math.random() * roomIds.length)];
      if (randomRoomId) {
        const room = this.rooms.get(randomRoomId);
        if (room) {
          room.connections.push(connectionId);
          connection.roomId = randomRoomId;
        }
      }
    }
    
    // Подписка на топики (если включены подписки)
    if (this.config.subscriptionsEnabled && this.subscriptions.size > 0) {
      const subscriptionIds = Array.from(this.subscriptions.keys()).filter(
        id => this.subscriptions.get(id)?.enabled
      );
      const randomSubId = subscriptionIds[Math.floor(Math.random() * subscriptionIds.length)];
      if (randomSubId) {
        const sub = this.subscriptions.get(randomSubId);
        if (sub) {
          sub.connections.push(connectionId);
          connection.subscriptions.push(randomSubId);
        }
      }
    }
  }
  
  /**
   * Симуляция сообщения
   */
  private simulateMessage(connectionId: string, direction: 'sent' | 'received'): void {
    if (!this.config) return;
    
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') return;
    
    const now = Date.now();
    
    // Проверка rate limiting для сообщений
    if (this.config.rateLimit?.enabled) {
      const windowDuration = 1000; // 1 second window
      const elapsed = now - this.rateLimitWindowStart;
      
      // Сброс окна если прошла секунда
      if (elapsed >= windowDuration) {
        this.rateLimitWindowStart = now;
        this.rateLimitConnectionsInWindow = 0;
        this.rateLimitMessagesInWindow = 0;
      }
      
      const maxMessagesPerSecond = this.config.rateLimit.messagesPerSecond || 1000;
      if (this.rateLimitMessagesInWindow >= maxMessagesPerSecond) {
        // Rate limit exceeded - reject message
        const errorMessage: WebSocketMessage = {
          id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connectionId,
          type: 'text',
          content: 'Rate limit exceeded',
          timestamp: now,
          direction,
          size: 0,
          error: 'Rate limit exceeded',
        };
        this.messageHistory.push(errorMessage);
        if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
          this.messageHistory.shift();
        }
        return;
      }
      
      this.rateLimitMessagesInWindow++;
    }
    
    const messageSize = 100 + Math.random() * 900; // 100-1000 bytes
    const latency = connection.latency || 10 + Math.random() * 20;
    
    const message: WebSocketMessage = {
      id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      connectionId,
      type: Math.random() > 0.9 ? 'binary' : 'text',
      content: direction === 'sent' ? 'Message sent' : 'Message received',
      timestamp: now,
      direction,
      size: messageSize,
      compressed: this.config.enableCompression && Math.random() > 0.5,
      latency,
      roomId: connection.roomId,
    };
    
    // Обновление счетчиков соединения
    if (direction === 'sent') {
      connection.messagesSent++;
      connection.bytesSent += messageSize;
    } else {
      connection.messagesReceived++;
      connection.bytesReceived += messageSize;
    }
    connection.lastMessageAt = now;
    
    // Добавление в историю
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
      this.messageHistory.shift();
    }
    
    // Обновление метрик
    this.wsMetrics.messagesTotal++;
    this.messagesThisSecond++;
    if (direction === 'sent') {
      this.wsMetrics.messagesSent++;
      this.wsMetrics.bytesSent += messageSize;
    } else {
      this.wsMetrics.messagesReceived++;
      this.wsMetrics.bytesReceived += messageSize;
    }
    
    // Добавление latency в историю
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
    
    // Broadcast в комнату (если есть)
    if (connection.roomId && this.config.roomsEnabled) {
      const room = this.rooms.get(connection.roomId);
      if (room) {
        room.messagesBroadcast++;
        // Симуляция отправки сообщения другим соединениям в комнате
        const otherConnections = room.connections.filter(id => id !== connectionId);
        for (const otherConnId of otherConnections.slice(0, 5)) { // Максимум 5 получателей
          const otherConn = this.connections.get(otherConnId);
          if (otherConn && otherConn.status === 'connected') {
            otherConn.messagesReceived++;
            otherConn.bytesReceived += messageSize;
          }
        }
      }
    }
    
    // Broadcast в подписки (если есть)
    if (connection.subscriptions.length > 0 && this.config.subscriptionsEnabled) {
      for (const subId of connection.subscriptions) {
        const sub = this.subscriptions.get(subId);
        if (sub && sub.enabled) {
          sub.messagesDelivered++;
          // Симуляция доставки подписчикам
          const otherSubscribers = sub.connections.filter(id => id !== connectionId);
          for (const otherConnId of otherSubscribers.slice(0, 10)) { // Максимум 10 получателей
            const otherConn = this.connections.get(otherConnId);
            if (otherConn && otherConn.status === 'connected') {
              otherConn.messagesReceived++;
              otherConn.bytesReceived += messageSize;
            }
          }
        }
      }
    }
  }
  
  /**
   * Обработка ping/pong
   */
  private processPingPong(): void {
    if (!this.config) return;
    
    const now = Date.now();
    const pingInterval = (this.config.pingInterval || 30) * 1000; // ms
    
    for (const connection of this.connections.values()) {
      if (connection.status !== 'connected') continue;
      
      const lastPing = connection.lastPingAt || connection.connectedAt || 0;
      
      if (now - lastPing >= pingInterval) {
        // Отправка ping
        connection.lastPingAt = now;
        
        // Симуляция pong (90% успешных)
        const pongSuccess = Math.random() > 0.1;
        if (pongSuccess) {
          connection.lastPongAt = now;
          this.pingPongHistory.push({ timestamp: now, success: true });
        } else {
          this.pingPongHistory.push({ timestamp: now, success: false });
          // Неудачный pong - закрываем соединение
          connection.status = 'disconnected';
          connection.disconnectedAt = now;
        }
        
        if (this.pingPongHistory.length > this.MAX_PING_PONG_HISTORY) {
          this.pingPongHistory.shift();
        }
      }
    }
  }
  
  /**
   * Закрытие неактивных соединений
   */
  private closeIdleConnections(): void {
    const now = Date.now();
    const idleTimeout = 300000; // 5 minutes
    
    for (const connection of this.connections.values()) {
      if (connection.status !== 'connected') continue;
      
      const lastActivity = connection.lastMessageAt || connection.connectedAt || 0;
      if (now - lastActivity > idleTimeout) {
        connection.status = 'disconnected';
        connection.disconnectedAt = now;
      }
    }
  }
  
  /**
   * Аутентификация соединения
   */
  private authenticateConnection(): boolean {
    if (!this.config?.authentication?.enabled) return true;
    
    const auth = this.config.authentication;
    
    switch (auth.method) {
      case 'token':
        // Симуляция проверки токена (90% успешных)
        return Math.random() > 0.1;
      case 'apiKey':
        // Симуляция проверки API ключа (95% успешных)
        return Math.random() > 0.05;
      case 'basic':
        // Симуляция basic auth (85% успешных)
        return Math.random() > 0.15;
      default:
        return true;
    }
  }
  
  /**
   * Обновление метрик соединений
   */
  private updateConnectionMetrics(): void {
    const now = Date.now();
    
    for (const connection of this.connections.values()) {
      if (connection.status !== 'connected') continue;
      
      const metrics: ConnectionMetrics = {
        connectionId: connection.id,
        messagesSent: connection.messagesSent,
        messagesReceived: connection.messagesReceived,
        bytesSent: connection.bytesSent,
        bytesReceived: connection.bytesReceived,
        averageLatency: connection.latency || 0,
        uptime: connection.connectedAt ? (now - connection.connectedAt) / 1000 : 0,
        lastActivity: connection.lastMessageAt || connection.connectedAt || 0,
      };
      
      this.connectionMetrics.set(connection.id, metrics);
    }
  }
  
  /**
   * Обновление метрик комнат
   */
  private updateRoomMetrics(): void {
    for (const room of this.rooms.values()) {
      const activeConnections = room.connections.filter(
        id => this.connections.get(id)?.status === 'connected'
      );
      
      const metrics: RoomMetrics = {
        roomId: room.id,
        connectionsCount: activeConnections.length,
        messagesBroadcast: room.messagesBroadcast,
        averageLatency: 15 + Math.random() * 10, // 15-25ms
      };
      
      this.roomMetrics.set(room.id, metrics);
    }
  }
  
  /**
   * Обновление метрик подписок
   */
  private updateSubscriptionMetrics(): void {
    for (const sub of this.subscriptions.values()) {
      if (!sub.enabled) continue;
      
      const activeConnections = sub.connections.filter(
        id => this.connections.get(id)?.status === 'connected'
      );
      
      const metrics: SubscriptionMetrics = {
        subscriptionId: sub.id,
        connectionsCount: activeConnections.length,
        messagesDelivered: sub.messagesDelivered,
        averageLatency: 20 + Math.random() * 15, // 20-35ms
      };
      
      this.subscriptionMetrics.set(sub.id, metrics);
    }
  }
  
  /**
   * Расчет общих метрик
   */
  private calculateMetrics(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastSecondStart) / 1000;
    
    // Обновление RPS каждую секунду
    if (deltaTime >= 1.0) {
      this.wsMetrics.connectionsPerSecond = this.connectionsThisSecond / deltaTime;
      this.wsMetrics.messagesPerSecond = this.messagesThisSecond / deltaTime;
      
      this.connectionsThisSecond = 0;
      this.messagesThisSecond = 0;
      this.lastSecondStart = now;
    }
    
    // Активные соединения
    this.wsMetrics.connectionsActive = Array.from(this.connections.values()).filter(
      c => c.status === 'connected'
    ).length;
    
    // Средняя latency
    if (this.latencyHistory.length > 0) {
      const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
      this.wsMetrics.averageLatency = sum / this.latencyHistory.length;
      
      // Перцентили
      const sorted = [...this.latencyHistory].sort((a, b) => a - b);
      this.wsMetrics.latencyP50 = sorted[Math.floor(sorted.length * 0.5)];
      this.wsMetrics.latencyP95 = sorted[Math.floor(sorted.length * 0.95)];
      this.wsMetrics.latencyP99 = sorted[Math.floor(sorted.length * 0.99)];
    }
    
    // Error rate (на основе неудачных соединений и сообщений)
    const totalConnections = this.wsMetrics.connectionsTotal;
    const failedConnections = Array.from(this.connections.values()).filter(
      c => c.status === 'error' || c.status === 'disconnected'
    ).length;
    this.wsMetrics.connectionErrorRate = totalConnections > 0 
      ? failedConnections / totalConnections 
      : 0;
    
    // Ping/Pong success rate
    if (this.pingPongHistory.length > 0) {
      const successful = this.pingPongHistory.filter(p => p.success).length;
      this.wsMetrics.pingPongSuccessRate = successful / this.pingPongHistory.length;
    }
    
    // Compression ratio
    const compressedMessages = this.messageHistory.filter(m => m.compressed).length;
    this.wsMetrics.compressionRatio = this.messageHistory.length > 0
      ? compressedMessages / this.messageHistory.length
      : 0.5;
    
    // Комнаты и подписки
    this.wsMetrics.roomsCount = this.rooms.size;
    this.wsMetrics.subscriptionsCount = Array.from(this.subscriptions.values()).filter(
      s => s.enabled
    ).length;
    
    // Среднее количество соединений на комнату
    if (this.rooms.size > 0) {
      const totalConnectionsInRooms = Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.connections.length, 0
      );
      this.wsMetrics.averageConnectionsPerRoom = totalConnectionsInRooms / this.rooms.size;
    }
    
    // Среднее количество подписок на соединение
    if (this.wsMetrics.connectionsActive > 0) {
      const totalSubscriptions = Array.from(this.connections.values()).reduce(
        (sum, conn) => sum + conn.subscriptions.length, 0
      );
      this.wsMetrics.averageSubscriptionsPerConnection = totalSubscriptions / this.wsMetrics.connectionsActive;
    }
    
    // Utilization
    const maxConnections = this.config?.maxConnections || 1000;
    this.wsMetrics.utilization = Math.min(1, this.wsMetrics.connectionsActive / maxConnections);
    
    // Error rate (общий)
    const totalMessages = this.wsMetrics.messagesTotal;
    const errorMessages = this.messageHistory.filter(m => m.error).length;
    this.wsMetrics.errorRate = totalMessages > 0 ? errorMessages / totalMessages : 0;
  }
  
  /**
   * Получение метрик WebSocket
   */
  public getWebSocketMetrics(): WebSocketMetrics {
    return { ...this.wsMetrics };
  }
  
  /**
   * Получение метрик соединений
   */
  public getConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }
  
  /**
   * Получение метрик комнат
   */
  public getRoomMetrics(): RoomMetrics[] {
    return Array.from(this.roomMetrics.values());
  }
  
  /**
   * Получение метрик подписок
   */
  public getSubscriptionMetrics(): SubscriptionMetrics[] {
    return Array.from(this.subscriptionMetrics.values());
  }
  
  /**
   * Получение активных соединений
   */
  public getActiveConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(c => c.status === 'connected');
  }
  
  /**
   * Получение комнат
   */
  public getRooms(): WebSocketRoom[] {
    return Array.from(this.rooms.values());
  }
  
  /**
   * Получение подписок
   */
  public getSubscriptions(): WebSocketSubscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.enabled);
  }
  
  /**
   * Получение истории сообщений
   */
  public getMessageHistory(limit: number = 100): WebSocketMessage[] {
    return this.messageHistory.slice(-limit);
  }
  
  /**
   * Обработка входящего сообщения из DataFlowEngine
   * Обрабатывает сообщение: broadcast в комнаты, доставка подписчикам, отправка в целевые компоненты
   */
  public processIncomingMessage(
    connectionId: string,
    payload: unknown,
    metadata?: Record<string, unknown>,
    direction: 'sent' | 'received' = 'received'
  ): {
    processed: boolean;
    broadcastToRoom?: string;
    deliveredToSubscriptions?: string[];
    forwarded?: boolean;
    error?: string;
  } {
    if (!this.config) {
      return { processed: false, error: 'Configuration not initialized' };
    }
    
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      return { processed: false, error: 'Connection not found or not connected' };
    }
    
    const now = Date.now();
    const messageContent = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
    const messageSize = new Blob([messageContent]).size;
    
    // Проверка размера сообщения
    const maxMessageSizeBytes = (this.config.maxMessageSize || 1024) * 1024; // KB to bytes
    if (messageSize > maxMessageSizeBytes) {
        const errorMessage: WebSocketMessage = {
          id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connectionId,
          type: 'text',
          content: 'Message size exceeds maximum',
          timestamp: now,
          direction: direction,
          size: messageSize,
          error: `Message size ${messageSize} bytes exceeds maximum ${maxMessageSizeBytes} bytes`,
        };
      this.messageHistory.push(errorMessage);
      if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
        this.messageHistory.shift();
      }
      this.wsMetrics.errorRate = (this.wsMetrics.errorRate * 0.9) + (0.1 * 1.0);
      return { processed: false, error: `Message size exceeds maximum ${maxMessageSizeBytes} bytes` };
    }
    
    // Проверка rate limiting для сообщений
    if (this.config.rateLimit?.enabled) {
      const windowDuration = 1000; // 1 second window
      const elapsed = now - this.rateLimitWindowStart;
      
      // Сброс окна если прошла секунда
      if (elapsed >= windowDuration) {
        this.rateLimitWindowStart = now;
        this.rateLimitConnectionsInWindow = 0;
        this.rateLimitMessagesInWindow = 0;
      }
      
      const maxMessagesPerSecond = this.config.rateLimit.messagesPerSecond || 1000;
      if (this.rateLimitMessagesInWindow >= maxMessagesPerSecond) {
        // Rate limit exceeded - reject message
        const errorMessage: WebSocketMessage = {
          id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connectionId,
          type: 'text',
          content: 'Rate limit exceeded',
          timestamp: now,
          direction: direction,
          size: messageSize,
          error: 'Rate limit exceeded',
        };
        this.messageHistory.push(errorMessage);
        if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
          this.messageHistory.shift();
        }
        this.wsMetrics.errorRate = (this.wsMetrics.errorRate * 0.9) + (0.1 * 1.0);
        return { processed: false, error: 'Rate limit exceeded' };
      }
      
      this.rateLimitMessagesInWindow++;
    }
    
    // Создаем сообщение
    const message: WebSocketMessage = {
      id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      connectionId,
      type: typeof payload === 'string' ? 'text' : 'binary',
      content: messageContent,
      timestamp: now,
      direction: direction,
      size: messageSize,
      compressed: this.config.enableCompression && Math.random() > 0.5,
      latency: connection.latency || 10 + Math.random() * 20,
      roomId: connection.roomId,
    };
    
    // Обновляем счетчики соединения в зависимости от направления
    if (direction === 'sent') {
      connection.messagesSent++;
      connection.bytesSent += messageSize;
    } else {
      connection.messagesReceived++;
      connection.bytesReceived += messageSize;
    }
    connection.lastMessageAt = now;
    
    // Добавляем в историю
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
      this.messageHistory.shift();
    }
    
    // Обновляем метрики в зависимости от направления
    this.wsMetrics.messagesTotal++;
    if (direction === 'sent') {
      this.wsMetrics.messagesSent++;
      this.wsMetrics.bytesSent += messageSize;
    } else {
      this.wsMetrics.messagesReceived++;
      this.wsMetrics.bytesReceived += messageSize;
    }
    this.messagesThisSecond++;
    
    // Добавляем latency в историю
    if (message.latency) {
      this.latencyHistory.push(message.latency);
      if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
        this.latencyHistory.shift();
      }
    }
    
    const result: {
      processed: boolean;
      broadcastToRoom?: string;
      deliveredToSubscriptions?: string[];
      forwarded?: boolean;
    } = {
      processed: true,
    };
    
    // Broadcast в комнату (если соединение в комнате)
    if (connection.roomId && this.config.roomsEnabled) {
      const room = this.rooms.get(connection.roomId);
      if (room) {
        room.messagesBroadcast++;
        message.roomId = connection.roomId;
        result.broadcastToRoom = connection.roomId;
        
        // Симуляция отправки другим соединениям в комнате
        const otherConnections = room.connections.filter(id => id !== connectionId);
        for (const otherConnId of otherConnections) {
          const otherConn = this.connections.get(otherConnId);
          if (otherConn && otherConn.status === 'connected') {
            otherConn.messagesReceived++;
            otherConn.bytesReceived += messageSize;
          }
        }
      }
    }
    
    // Доставка подписчикам
    if (connection.subscriptions.length > 0 && this.config.subscriptionsEnabled) {
      const deliveredSubs: string[] = [];
      for (const subId of connection.subscriptions) {
        const sub = this.subscriptions.get(subId);
        if (sub && sub.enabled) {
          sub.messagesDelivered++;
          message.subscriptionId = subId;
          deliveredSubs.push(subId);
          
          // Симуляция доставки другим подписчикам
          const otherSubscribers = sub.connections.filter(id => id !== connectionId);
          for (const otherConnId of otherSubscribers) {
            const otherConn = this.connections.get(otherConnId);
            if (otherConn && otherConn.status === 'connected') {
              otherConn.messagesReceived++;
              otherConn.bytesReceived += messageSize;
            }
          }
        }
      }
      if (deliveredSubs.length > 0) {
        result.deliveredToSubscriptions = deliveredSubs;
      }
    }
    
    // Отправка в целевые компоненты (если есть sendMessageToTarget)
    if (this.sendMessageToTarget && this.componentId) {
      // Определяем целевые компоненты из metadata или используем дефолтное поведение
      const targetIds = (metadata?.targetIds as string[]) || [];
      
      if (targetIds.length > 0) {
        for (const targetId of targetIds) {
          // Создаем DataMessage для отправки
          const dataMessage: DataMessage = {
            id: `ws-forward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: this.componentId,
            target: targetId,
            payload: payload,
            format: typeof payload === 'string' ? 'text' : 'json',
            timestamp: now,
            status: 'in_transit',
            metadata: {
              ...metadata,
              connectionId,
              roomId: connection.roomId,
              subscriptions: connection.subscriptions,
            },
          };
          
          // Отправляем асинхронно (не ждем результата)
          this.sendMessageToTarget(this.componentId, targetId, dataMessage)
            .catch(() => {
              // Игнорируем ошибки отправки
            });
        }
        result.forwarded = true;
      }
    }
    
    return result;
  }
  
  /**
   * Сброс метрик
   */
  public resetMetrics(): void {
    this.wsMetrics = {
      connectionsTotal: 0,
      connectionsActive: 0,
      connectionsPerSecond: 0,
      messagesPerSecond: 0,
      messagesTotal: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      averageLatency: 0,
      errorRate: 0,
      connectionErrorRate: 0,
      pingPongSuccessRate: 1.0,
      compressionRatio: 0.5,
      roomsCount: 0,
      subscriptionsCount: 0,
      averageConnectionsPerRoom: 0,
      averageSubscriptionsPerConnection: 0,
      utilization: 0,
    };
    
    this.messageHistory = [];
    this.latencyHistory = [];
    this.pingPongHistory = [];
    this.connectionsThisSecond = 0;
    this.messagesThisSecond = 0;
  }
  
  /**
   * Обновление конфигурации
   */
  public updateConfig(config: Partial<WebSocketConfig>): void {
    if (!this.config) {
      // Если конфиг еще не инициализирован, создаем его
      this.config = {
        endpoint: config.endpoint || 'ws://localhost:8080/ws',
        protocol: config.protocol || 'ws',
        enableCompression: config.enableCompression ?? true,
        enablePingPong: config.enablePingPong ?? true,
        pingInterval: config.pingInterval || 30,
        maxConnections: config.maxConnections || 1000,
        maxMessageSize: config.maxMessageSize || 1024,
        roomsEnabled: config.roomsEnabled ?? true,
        subscriptionsEnabled: config.subscriptionsEnabled ?? true,
        authentication: config.authentication || {
          enabled: false,
          method: 'none',
        },
        rateLimit: config.rateLimit || {
          enabled: false,
          messagesPerSecond: 1000,
          connectionsPerSecond: 100,
        },
        ...config,
      };
    } else {
      // Обновляем существующий конфиг
      this.config = { ...this.config, ...config };
    }
    
    // Обновление комнат
    if (config.rooms !== undefined) {
      this.rooms.clear();
      for (const room of config.rooms) {
        this.rooms.set(room.id, { ...room });
      }
    }
    
    // Обновление подписок
    if (config.subscriptions !== undefined) {
      this.subscriptions.clear();
      for (const sub of config.subscriptions) {
        if (sub.enabled) {
          this.subscriptions.set(sub.id, { ...sub });
        }
      }
    }
    
    // Применяем ограничения maxConnections
    if (config.maxConnections !== undefined && this.connections.size > config.maxConnections) {
      // Закрываем лишние соединения (самые старые)
      const connectionsArray = Array.from(this.connections.entries())
        .sort((a, b) => (a[1].connectedAt || 0) - (b[1].connectedAt || 0));
      
      const toRemove = connectionsArray.slice(0, this.connections.size - config.maxConnections);
      for (const [id] of toRemove) {
        const conn = this.connections.get(id);
        if (conn) {
          conn.status = 'disconnected';
          conn.disconnectedAt = Date.now();
        }
      }
    }
  }
}
