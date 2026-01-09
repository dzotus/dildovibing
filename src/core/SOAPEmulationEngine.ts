import { CanvasNode, CanvasConnection } from '@/types';
import { JaegerSpan, TraceContext } from './JaegerEmulationEngine';
import { DataMessage } from './DataFlowEngine';

/**
 * SOAP Request
 */
export interface SOAPRequest {
  id: string;
  operation?: string;
  service?: string;
  envelope: string; // XML SOAP Envelope
  headers?: Record<string, string>;
  timestamp: number;
  duration?: number;
  success?: boolean;
  error?: string;
  soapVersion?: '1.1' | '1.2';
  clientIP?: string;
}

/**
 * SOAP Response
 */
export interface SOAPResponse {
  envelope: string; // XML SOAP Envelope
  status: number; // HTTP status
  latency: number;
  success: boolean;
  error?: string;
  fault?: SOAPFault;
}

/**
 * SOAP Fault
 */
export interface SOAPFault {
  code: string; // Fault code (e.g., "Server", "Client", "VersionMismatch")
  string: string; // Fault string
  actor?: string; // Fault actor
  detail?: string; // Fault detail
}

/**
 * SOAP Operation
 */
export interface SOAPOperation {
  name: string;
  inputMessage?: string;
  outputMessage?: string;
  faults?: string[];
  targetService?: string; // ID of target service node
  latency?: number; // ms
  enabled?: boolean;
}

/**
 * SOAP Service
 */
export interface SOAPService {
  name: string;
  port: string;
  operations: SOAPOperation[];
  wsdlUrl?: string;
  endpoint?: string;
}

/**
 * WSDL Definition (simplified)
 */
export interface WSDLDefinition {
  targetNamespace?: string;
  services?: SOAPService[];
  types?: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
    }>;
  }>;
  messages?: Array<{
    name: string;
    parts: Array<{
      name: string;
      type: string;
    }>;
  }>;
  portTypes?: Array<{
    name: string;
    operations: Array<{
      name: string;
      input?: string;
      output?: string;
      faults?: string[];
    }>;
  }>;
  bindings?: Array<{
    name: string;
    type: string;
    style?: 'document' | 'rpc';
    transport?: string;
  }>;
}

/**
 * SOAP Configuration
 */
export interface SOAPConfig {
  endpoint?: string;
  wsdlUrl?: string;
  services?: SOAPService[];
  requests?: SOAPRequest[];
  totalRequests?: number;
  successRate?: number;
  averageLatency?: number;
  enableWSSecurity?: boolean;
  enableWSAddressing?: boolean;
  enableMTOM?: boolean;
  enableValidation?: boolean;
  soapVersion?: '1.1' | '1.2';
  requestsPerSecond?: number;
  responseLatency?: number; // ms
  enableCaching?: boolean;
  cacheTTL?: number; // seconds
  rateLimit?: {
    enabled?: boolean;
    requestsPerSecond?: number;
    windowMs?: number;
    identifyBy?: 'ip' | 'apiKey' | 'user' | 'all';
  };
  timeout?: {
    enabled?: boolean;
    requestTimeout?: number; // ms
    defaultTimeout?: number; // ms
  };
  maxRequestSize?: number; // bytes, default 10MB
  wsdl?: WSDLDefinition;
}

/**
 * SOAP Metrics
 */
export interface SOAPMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  successRate: number;
  averageLatency: number;
  latencyP50?: number; // 50th percentile latency
  latencyP95?: number; // 95th percentile latency
  latencyP99?: number; // 99th percentile latency
  operationMetrics?: OperationMetrics[];
  serviceMetrics?: ServiceMetrics[];
  errorMetrics?: ErrorMetrics[];
  rateLimitMetrics?: RateLimitMetrics;
  timeoutMetrics?: TimeoutMetrics;
  wsSecurityMetrics?: WSSecurityMetrics;
  wsAddressingMetrics?: WSAddressingMetrics;
  mtomMetrics?: MTOMMetrics;
  requestSizeMetrics?: RequestSizeMetrics;
  throughputTrends?: ThroughputTrend;
}

/**
 * WS-Security Metrics
 */
export interface WSSecurityMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  validationSuccessRate: number;
  signaturesProcessed: number;
  encryptionsProcessed: number;
}

/**
 * WS-Addressing Metrics
 */
export interface WSAddressingMetrics {
  totalMessages: number;
  messagesWithAddressing: number;
  asyncResponses: number;
  addressingUsageRate: number;
}

/**
 * MTOM Metrics
 */
export interface MTOMMetrics {
  totalMessages: number;
  messagesWithMTOM: number;
  totalAttachments: number;
  averageAttachmentsPerMessage: number;
  mtomUsageRate: number;
}

/**
 * Request Size Metrics
 */
export interface RequestSizeMetrics {
  totalRequests: number;
  averageRequestSize: number; // bytes
  minRequestSize: number;
  maxRequestSize: number;
  totalBytesReceived: number;
  totalBytesSent: number;
  averageResponseSize: number; // bytes
  sizeDistribution?: Array<{ range: string; count: number }>;
}

/**
 * Throughput Trend
 */
export interface ThroughputTrend {
  current: number; // requests per second
  previous: number; // previous second
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  peak: number; // peak requests per second
  peakTime?: number; // timestamp of peak
}

/**
 * Operation-level Metrics
 */
export interface OperationMetrics {
  operationName: string;
  serviceName: string;
  totalCalls: number;
  totalErrors: number;
  averageLatency: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  lastCallTime?: number;
  errorRate: number;
  callsPerSecond: number;
}

/**
 * Service-level Metrics
 */
export interface ServiceMetrics {
  serviceName: string;
  totalRequests: number;
  totalErrors: number;
  averageLatency: number;
  errorRate: number;
  requestsPerSecond: number;
  operationsCount: number;
}

/**
 * Error Metrics
 */
export interface ErrorMetrics {
  category: ErrorCategory;
  totalErrors: number;
  errorsPerSecond: number;
  lastErrorTime?: number;
}

export type ErrorCategory = 'validation' | 'security' | 'timeout' | 'fault' | 'rate_limit' | 'other';

/**
 * Rate Limit Metrics
 */
export interface RateLimitMetrics {
  totalBlockedRequests: number;
  blockedRequestsPerSecond: number;
  totalRateLimitHits: number;
  rateLimitHitsPerSecond: number;
}

/**
 * Timeout Metrics
 */
export interface TimeoutMetrics {
  totalTimeouts: number;
  timeoutsPerSecond: number;
}

/**
 * SOAP Emulation Engine
 * Симулирует работу SOAP сервера: обработка запросов, валидация, выполнение, метрики
 */
export class SOAPEmulationEngine {
  private config: SOAPConfig | null = null;
  
  // Метрики SOAP
  private soapMetrics: SOAPMetrics = {
    requestsPerSecond: 0,
    averageResponseTime: 0,
    totalRequests: 0,
    totalErrors: 0,
    errorRate: 0,
    successRate: 0,
    averageLatency: 0,
  };
  
  // История запросов для расчета метрик
  private requestHistory: SOAPRequest[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Кэш запросов
  private requestCache: Map<string, { response: SOAPResponse; timestamp: number }> = new Map();
  
  // История latency для расчета среднего
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 500;
  
  // Временные метки для расчета RPS
  private lastSecondStart: number = Date.now();
  private requestsThisSecond: number = 0;
  
  // Метрики операций
  private operationMetrics: Map<string, OperationMetrics> = new Map(); // key: "serviceName:operationName"
  
  // Метрики сервисов
  private serviceMetrics: Map<string, ServiceMetrics> = new Map(); // key: serviceName
  
  // ID SOAP компонента (для поиска соединений)
  private componentId: string | null = null;
  
  // Функция для отправки сообщений к целевым компонентам
  private sendMessageToTarget?: (
    sourceId: string,
    targetId: string,
    message: DataMessage
  ) => Promise<DataMessage | null>;
  
  // Активные запросы с таймаутами
  private activeRequests: Map<string, {
    timeoutId: NodeJS.Timeout;
    startTime: number;
    operationName: string;
    serviceName: string;
  }> = new Map();
  
  // Tracing support
  private traceContexts: Map<string, TraceContext> = new Map(); // traceId -> TraceContext
  private traceIdCounter: number = 0;
  private spanIdCounter: number = 0;
  
  // Error categorization
  private errorMetrics: Map<ErrorCategory, ErrorMetrics> = new Map();
  private readonly MAX_ERROR_HISTORY = 100;
  private errorHistory: Array<{
    timestamp: number;
    category: ErrorCategory;
    message: string;
    operationName?: string;
    serviceName?: string;
  }> = [];
  private readonly MAX_TOTAL_ERROR_HISTORY = 500;
  
  // Счетчики для расчета per-second метрик
  private operationCallsThisSecond: Map<string, number> = new Map();
  private serviceRequestsThisSecond: Map<string, number> = new Map();
  private errorCountsThisSecond: Map<ErrorCategory, number> = new Map();
  private lastMetricsSecondStart: number = Date.now();
  
  // Rate limiting
  private rateLimitCounters: Map<string, {
    count: number;
    resetAt: number;
    windowStart: number;
  }> = new Map(); // key: identifier -> counter
  private rateLimitMetrics: RateLimitMetrics = {
    totalBlockedRequests: 0,
    blockedRequestsPerSecond: 0,
    totalRateLimitHits: 0,
    rateLimitHitsPerSecond: 0,
  };
  private blockedRequestsThisSecond: number = 0;
  private rateLimitHitsThisSecond: number = 0;
  private lastRateLimitSecondStart: number = Date.now();
  
  // Timeout tracking
  private timeoutMetrics: TimeoutMetrics = {
    totalTimeouts: 0,
    timeoutsPerSecond: 0,
  };
  private timeoutsThisSecond: number = 0;
  private lastTimeoutSecondStart: number = Date.now();
  private timeoutDurations: number[] = []; // История длительностей до таймаута
  private readonly MAX_TIMEOUT_HISTORY = 100;
  
  // WS-Security metrics
  private wsSecurityMetrics: WSSecurityMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    validationSuccessRate: 0,
    signaturesProcessed: 0,
    encryptionsProcessed: 0,
  };
  
  // WS-Addressing metrics
  private wsAddressingMetrics: WSAddressingMetrics = {
    totalMessages: 0,
    messagesWithAddressing: 0,
    asyncResponses: 0,
    addressingUsageRate: 0,
  };
  
  // MTOM metrics
  private mtomMetrics: MTOMMetrics = {
    totalMessages: 0,
    messagesWithMTOM: 0,
    totalAttachments: 0,
    averageAttachmentsPerMessage: 0,
    mtomUsageRate: 0,
  };
  
  // Request size metrics
  private requestSizeMetrics: RequestSizeMetrics = {
    totalRequests: 0,
    averageRequestSize: 0,
    minRequestSize: Infinity,
    maxRequestSize: 0,
    totalBytesReceived: 0,
    totalBytesSent: 0,
    averageResponseSize: 0,
    sizeDistribution: [],
  };
  
  // Throughput trends
  private throughputHistory: number[] = []; // История RPS за последние секунды
  private readonly MAX_THROUGHPUT_HISTORY = 60; // 60 секунд истории
  private previousRPS: number = 0;
  private peakRPS: number = 0;
  private peakRPSTime: number = 0;
  
  // Latency percentiles calculation
  private readonly PERCENTILE_P50 = 50;
  private readonly PERCENTILE_P95 = 95;
  private readonly PERCENTILE_P99 = 99;
  
  /**
   * Инициализирует конфигурацию SOAP из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    this.componentId = node.id;
    const config = (node.data.config || {}) as SOAPConfig;
    this.config = {
      endpoint: config.endpoint || '/soap',
      wsdlUrl: config.wsdlUrl || '',
      services: config.services || [],
      requests: config.requests || [],
      totalRequests: config.totalRequests || 0,
      successRate: config.successRate || 100,
      averageLatency: config.averageLatency || 50,
      enableWSSecurity: config.enableWSSecurity ?? false,
      enableWSAddressing: config.enableWSAddressing ?? false,
      enableMTOM: config.enableMTOM ?? false,
      enableValidation: config.enableValidation ?? true,
      soapVersion: config.soapVersion || '1.1',
      requestsPerSecond: config.requestsPerSecond || 100,
      responseLatency: config.responseLatency || 50,
      enableCaching: config.enableCaching ?? false,
      cacheTTL: config.cacheTTL ?? 300,
      rateLimit: config.rateLimit || {
        enabled: false,
        requestsPerSecond: 1000,
        windowMs: 1000,
        identifyBy: 'ip',
      },
      timeout: config.timeout || {
        enabled: false,
        requestTimeout: 30000,
        defaultTimeout: 30000,
      },
      maxRequestSize: config.maxRequestSize || 10 * 1024 * 1024, // 10MB default
      wsdl: config.wsdl,
    };
    
    // Инициализируем метрики для существующих сервисов и операций
    if (this.config.services) {
      for (const service of this.config.services) {
        this.initializeServiceMetrics(service.name);
        for (const operation of service.operations) {
          this.initializeOperationMetrics(service.name, operation.name);
        }
      }
    }
  }
  
  /**
   * Обновляет конфигурацию
   */
  updateConfig(config: Partial<SOAPConfig>): void {
    if (!this.config) return;
    this.config = { ...this.config, ...config };
    
    // Обновляем метрики для новых сервисов и операций
    if (config.services) {
      for (const service of config.services) {
        if (!this.serviceMetrics.has(service.name)) {
          this.initializeServiceMetrics(service.name);
        }
        for (const operation of service.operations) {
          const key = `${service.name}:${operation.name}`;
          if (!this.operationMetrics.has(key)) {
            this.initializeOperationMetrics(service.name, operation.name);
          }
        }
      }
    }
  }
  
  /**
   * Инициализирует метрики для сервиса
   */
  private initializeServiceMetrics(serviceName: string): void {
    if (!this.serviceMetrics.has(serviceName)) {
      this.serviceMetrics.set(serviceName, {
        serviceName,
        totalRequests: 0,
        totalErrors: 0,
        averageLatency: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        operationsCount: 0,
      });
    }
  }
  
  /**
   * Инициализирует метрики для операции
   */
  private initializeOperationMetrics(serviceName: string, operationName: string): void {
    const key = `${serviceName}:${operationName}`;
    if (!this.operationMetrics.has(key)) {
      this.operationMetrics.set(key, {
        operationName,
        serviceName,
        totalCalls: 0,
        totalErrors: 0,
        averageLatency: 0,
        totalLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        errorRate: 0,
        callsPerSecond: 0,
      });
    }
  }
  
  /**
   * Устанавливает функцию для отправки сообщений к целевым компонентам
   */
  public setSendMessageFunction(
    sendMessage: (sourceId: string, targetId: string, message: DataMessage) => Promise<DataMessage | null>
  ): void {
    this.sendMessageToTarget = sendMessage;
  }
  
  /**
   * Обрабатывает SOAP запрос
   */
  public processRequest(
    request: {
      envelope: string;
      operation?: string;
      service?: string;
      headers?: Record<string, string>;
      clientIP?: string;
    },
    nodes?: CanvasNode[],
    connections?: CanvasConnection[],
    getJaegerEngines?: () => Map<string, any>
  ): SOAPResponse {
    const startTime = Date.now();
    const traceContext = this.createRequestSpan(
      request.operation || 'unknown',
      startTime,
      getJaegerEngines
    );
    
    if (!this.config) {
      return this.createErrorResponse('SOAP service not configured', 500, startTime);
    }
    
    // 0. Проверка размера запроса
    const initialRequestSize = request.envelope ? Buffer.byteLength(request.envelope, 'utf8') : 0;
    if (this.config.maxRequestSize && initialRequestSize > this.config.maxRequestSize) {
      this.recordError('validation', `Request size ${initialRequestSize} bytes exceeds maximum ${this.config.maxRequestSize} bytes`, request.operation, request.service);
      return this.createFaultResponse(
        'Client',
        `Request too large: ${initialRequestSize} bytes exceeds maximum ${this.config.maxRequestSize} bytes`,
        Date.now() - startTime
      );
    }
    
    // 1. Rate limiting
    if (this.config.rateLimit?.enabled) {
      const clientId = this.getClientIdentifier(request.clientIP, request.headers);
      if (!this.checkRateLimit(clientId)) {
        this.recordError('rate_limit', 'Rate limit exceeded', request.operation, request.service);
        return this.createErrorResponse('Rate limit exceeded', 429, startTime);
      }
    }
    
    // 2. Парсинг SOAP Envelope
    const parsedEnvelope = this.parseSOAPEnvelope(request.envelope);
    if (!parsedEnvelope.success) {
      this.recordError('validation', parsedEnvelope.error || 'Invalid SOAP envelope', request.operation, request.service);
      return this.createFaultResponse(
        'Client',
        parsedEnvelope.error || 'Invalid SOAP envelope',
        startTime
      );
    }
    
    // 3. Определение операции и сервиса
    const operationName = request.operation || parsedEnvelope.operation || 'unknown';
    const serviceName = request.service || parsedEnvelope.service || 'default';
    
    // 4. WS-Security проверка (если включена)
    if (this.config.enableWSSecurity && parsedEnvelope.headers) {
      this.wsSecurityMetrics.totalValidations++;
      const securityResult = this.validateWSSecurity(parsedEnvelope.headers, request.envelope);
      if (!securityResult.valid) {
        this.wsSecurityMetrics.failedValidations++;
        this.recordError('security', securityResult.error || 'WS-Security validation failed', operationName, serviceName);
        return this.createFaultResponse('Client', securityResult.error || 'WS-Security validation failed', startTime);
      }
      this.wsSecurityMetrics.successfulValidations++;
      if (parsedEnvelope.headers['Security']?.includes('Signature')) {
        this.wsSecurityMetrics.signaturesProcessed++;
      }
      if (parsedEnvelope.headers['Security']?.includes('EncryptedData')) {
        this.wsSecurityMetrics.encryptionsProcessed++;
      }
      this.wsSecurityMetrics.validationSuccessRate = this.wsSecurityMetrics.totalValidations > 0
        ? (this.wsSecurityMetrics.successfulValidations / this.wsSecurityMetrics.totalValidations) * 100
        : 0;
    }
    
    // 5. WS-Addressing обработка (если включена)
    if (this.config.enableWSAddressing && parsedEnvelope.headers) {
      this.wsAddressingMetrics.totalMessages++;
      if (parsedEnvelope.headers['MessageID']) {
        this.wsAddressingMetrics.messagesWithAddressing++;
      }
      const addressingResult = this.processWSAddressing(parsedEnvelope.headers);
      if (!addressingResult.success) {
        this.recordError('validation', addressingResult.error || 'WS-Addressing processing failed', operationName, serviceName);
        // WS-Addressing ошибки обычно не блокируют запрос, но логируем
      }
      if (addressingResult.replyTo) {
        this.wsAddressingMetrics.asyncResponses++;
      }
      this.wsAddressingMetrics.addressingUsageRate = this.wsAddressingMetrics.totalMessages > 0
        ? (this.wsAddressingMetrics.messagesWithAddressing / this.wsAddressingMetrics.totalMessages) * 100
        : 0;
    }
    
    // 6. MTOM обработка (если включена)
    if (this.config.enableMTOM && parsedEnvelope.body) {
      this.mtomMetrics.totalMessages++;
      const mtomResult = this.processMTOM(parsedEnvelope.body);
      if (mtomResult.processed) {
        this.mtomMetrics.messagesWithMTOM++;
        if (mtomResult.attachments) {
          this.mtomMetrics.totalAttachments += mtomResult.attachments.length;
        }
        parsedEnvelope.body = mtomResult.body || parsedEnvelope.body;
        this.mtomMetrics.averageAttachmentsPerMessage = this.mtomMetrics.messagesWithMTOM > 0
          ? this.mtomMetrics.totalAttachments / this.mtomMetrics.messagesWithMTOM
          : 0;
        this.mtomMetrics.mtomUsageRate = this.mtomMetrics.totalMessages > 0
          ? (this.mtomMetrics.messagesWithMTOM / this.mtomMetrics.totalMessages) * 100
          : 0;
      }
    }
    
    // 7. Валидация против WSDL (если включена)
    if (this.config.enableValidation && this.config.wsdl) {
      const validationResult = this.validateRequest(parsedEnvelope, operationName, serviceName);
      if (!validationResult.valid) {
        this.recordError('validation', validationResult.error || 'Validation failed', operationName, serviceName);
        return this.createFaultResponse('Client', validationResult.error || 'Validation failed', startTime);
      }
    }
    
    // 8. Проверка кэша (если включен)
    if (this.config.enableCaching) {
      const cacheKey = this.generateCacheKey(request.envelope, operationName);
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < (this.config.cacheTTL || 300) * 1000) {
        const latency = Date.now() - startTime;
        const requestSize = request.envelope ? Buffer.byteLength(request.envelope, 'utf8') : undefined;
        const responseSize = cached.response.envelope ? Buffer.byteLength(cached.response.envelope, 'utf8') : undefined;
        this.recordRequest(operationName, serviceName, latency, true, requestSize, responseSize);
        return {
          ...cached.response,
          latency,
        };
      }
    }
    
    // 9. Выполнение операции с проверкой таймаута
    const timeout = this.config.timeout?.enabled 
      ? (this.config.timeout.requestTimeout || this.config.timeout.defaultTimeout || 30000)
      : undefined;
    
    const operationStartTime = Date.now();
    const operationResult = this.executeOperation(
      operationName,
      serviceName,
      parsedEnvelope.body || '',
      nodes,
      connections,
      traceContext,
      getJaegerEngines
    );
    
    const operationLatency = Date.now() - operationStartTime;
    
    // Проверяем таймаут после выполнения операции
    if (timeout && operationLatency > timeout) {
      this.timeoutMetrics.totalTimeouts++;
      this.timeoutsThisSecond++;
      this.recordError('timeout', `Operation ${operationName} exceeded timeout of ${timeout}ms (took ${operationLatency}ms)`, operationName, serviceName);
      return this.createFaultResponse(
        'Server',
        `Operation timed out: exceeded ${timeout}ms (took ${operationLatency}ms)`,
        Date.now() - startTime
      );
    }
    
    const latency = Date.now() - startTime;
    
    // 10. Создание ответа
    let response: SOAPResponse;
    if (operationResult.success) {
      response = this.createSuccessResponse(
        operationName,
        operationResult.data || {},
        this.config.soapVersion || '1.1',
        latency,
        parsedEnvelope.headers
      );
      
      // Сохраняем в кэш
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(request.envelope, operationName);
        this.requestCache.set(cacheKey, {
          response,
          timestamp: Date.now(),
        });
      }
    } else {
      response = this.createFaultResponse(
        'Server',
        operationResult.error || 'Operation failed',
        latency
      );
      this.recordError('fault', operationResult.error || 'Operation failed', operationName, serviceName);
    }
    
    // 11. Запись метрик (с размерами запроса и ответа)
    const requestSize = request.envelope ? Buffer.byteLength(request.envelope, 'utf8') : undefined;
    const responseSize = response.envelope ? Buffer.byteLength(response.envelope, 'utf8') : undefined;
    this.recordRequest(operationName, serviceName, latency, operationResult.success, requestSize, responseSize);
    
    // 12. Завершение span
    this.finishRequestSpan(traceContext, startTime, Date.now(), operationResult.success, operationResult.error, getJaegerEngines);
    
    return response;
  }
  
  /**
   * Парсит SOAP Envelope с улучшенной обработкой XML
   */
  private parseSOAPEnvelope(envelope: string): {
    success: boolean;
    operation?: string;
    service?: string;
    body?: string;
    header?: string;
    error?: string;
    soapVersion?: '1.1' | '1.2';
    headers?: Record<string, string>;
    bodyElements?: Array<{ name: string; value: string }>;
  } {
    try {
      // Базовая валидация XML структуры
      if (!envelope || typeof envelope !== 'string') {
        return { success: false, error: 'Envelope is empty or invalid' };
      }
      
      // Проверка наличия основных элементов SOAP
      if (!envelope.includes('<') || !envelope.includes('>')) {
        return { success: false, error: 'Invalid XML format' };
      }
      
      // Проверка наличия Envelope
      const hasEnvelope = /<[^:>]*:?Envelope[^>]*>/i.test(envelope);
      if (!hasEnvelope) {
        return { success: false, error: 'SOAP Envelope element not found' };
      }
      
      // Определяем версию SOAP
      const soapVersion = envelope.includes('http://schemas.xmlsoap.org/soap/envelope/') 
        ? '1.1' 
        : envelope.includes('http://www.w3.org/2003/05/soap-envelope')
        ? '1.2'
        : '1.1'; // По умолчанию 1.1
      
      // Извлекаем Header (если есть)
      const headerMatch = envelope.match(/<soap:?Header[^>]*>(.*?)<\/soap:?Header>/is);
      const header = headerMatch ? headerMatch[1] : undefined;
      
      // Парсим заголовки из Header
      const headers: Record<string, string> = {};
      if (header) {
        // Извлекаем WS-Addressing заголовки
        const messageIdMatch = header.match(/<wsa:MessageID[^>]*>(.*?)<\/wsa:MessageID>/is);
        if (messageIdMatch) {
          headers['MessageID'] = messageIdMatch[1].trim();
        }
        
        const toMatch = header.match(/<wsa:To[^>]*>(.*?)<\/wsa:To>/is);
        if (toMatch) {
          headers['To'] = toMatch[1].trim();
        }
        
        const fromMatch = header.match(/<wsa:From[^>]*>(.*?)<\/wsa:From>/is);
        if (fromMatch) {
          headers['From'] = fromMatch[1].trim();
        }
        
        const replyToMatch = header.match(/<wsa:ReplyTo[^>]*>(.*?)<\/wsa:ReplyTo>/is);
        if (replyToMatch) {
          headers['ReplyTo'] = replyToMatch[1].trim();
        }
        
        const actionMatch = header.match(/<wsa:Action[^>]*>(.*?)<\/wsa:Action>/is);
        if (actionMatch) {
          headers['Action'] = actionMatch[1].trim();
        }
        
        // Извлекаем WS-Security заголовки
        const securityMatch = header.match(/<wsse:Security[^>]*>(.*?)<\/wsse:Security>/is);
        if (securityMatch) {
          headers['Security'] = securityMatch[1].trim();
        }
      }
      
      // Извлекаем Body с улучшенной обработкой
      const bodyMatch = envelope.match(/<[^:>]*:?Body[^>]*>(.*?)<\/[^:>]*:?Body>/is);
      if (!bodyMatch) {
        return { success: false, error: 'SOAP Body not found' };
      }
      
      const body = bodyMatch[1];
      
      // Проверка наличия содержимого в Body
      if (!body.trim()) {
        return { success: false, error: 'SOAP Body is empty' };
      }
      
      // Извлекаем имя операции (первый элемент в Body)
      // Поддерживаем различные форматы: <operationName>, <operationNameRequest>, <operationNameInput>
      // Улучшенный regex для более точного извлечения
      const operationMatch = body.match(/<([^:>\/\s]+:)?([^:>\/\s]+?)(?:Request|Input|Response|Output)?[^>]*>/i);
      const operation = operationMatch ? operationMatch[2] : undefined;
      
      // Если не нашли операцию, пытаемся найти первый элемент
      if (!operation) {
        const firstElementMatch = body.match(/<([^:>\/\s]+:)?([^:>\/\s]+)[^>]*>/i);
        if (firstElementMatch) {
          const extractedOperation = firstElementMatch[2];
          // Убираем суффиксы типа Request, Response и т.д.
          const cleanOperation = extractedOperation.replace(/(Request|Response|Input|Output)$/i, '');
          if (cleanOperation) {
            return {
              success: true,
              operation: cleanOperation,
              service,
              body,
              header,
              soapVersion,
              headers,
              bodyElements: [],
            };
          }
        }
      }
      
      // Извлекаем все элементы из Body
      const bodyElements: Array<{ name: string; value: string }> = [];
      const elementRegex = /<([^:>]+:)?([^:>]+)[^>]*>(.*?)<\/\1?\2>/gis;
      let elementMatch;
      while ((elementMatch = elementRegex.exec(body)) !== null) {
        const elementName = elementMatch[2];
        const elementValue = elementMatch[3].trim();
        if (elementName && elementValue) {
          bodyElements.push({
            name: elementName,
            value: elementValue,
          });
        }
      }
      
      // Определяем сервис из Action заголовка или endpoint
      let service: string | undefined;
      if (headers['Action']) {
        // Action обычно имеет формат: namespace/service/operation
        const actionParts = headers['Action'].split('/');
        if (actionParts.length > 1) {
          service = actionParts[actionParts.length - 2];
        }
      }
      
      return {
        success: true,
        operation,
        service,
        body,
        header,
        soapVersion,
        headers,
        bodyElements,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse SOAP envelope',
      };
    }
  }
  
  /**
   * Валидирует запрос против WSDL
   */
  private validateRequest(
    parsedEnvelope: { operation?: string; body?: string; soapVersion?: '1.1' | '1.2' },
    operationName: string,
    serviceName: string
  ): { valid: boolean; error?: string } {
    if (!this.config?.wsdl) {
      return { valid: true }; // Нет WSDL, валидация пропускается
    }
    
    // 1. Проверка существования сервиса
    const service = this.config.wsdl.services?.find(s => s.name === serviceName);
    if (!service) {
      return { valid: false, error: `Service ${serviceName} not found in WSDL` };
    }
    
    // 2. Проверка существования операции
    const operation = service.operations.find(op => op.name === operationName);
    if (!operation) {
      return { valid: false, error: `Operation ${operationName} not found in service ${serviceName}` };
    }
    
    // 3. Проверка версии SOAP (если указана в WSDL)
    if (parsedEnvelope.soapVersion && this.config.soapVersion) {
      if (parsedEnvelope.soapVersion !== this.config.soapVersion) {
        return { valid: false, error: `SOAP version mismatch: expected ${this.config.soapVersion}, got ${parsedEnvelope.soapVersion}` };
      }
    }
    
    // 4. Валидация структуры Body (улучшенная проверка)
    if (parsedEnvelope.body) {
      // Проверяем, что в Body есть элемент с именем операции
      // Используем более точную проверку с учетом namespace
      const operationPatterns = [
        new RegExp(`<[^:>]*:?${operationName}[^>]*>`, 'i'),
        new RegExp(`<[^:>]*:?${operationName}Request[^>]*>`, 'i'),
        new RegExp(`<[^:>]*:?${operationName}Input[^>]*>`, 'i'),
      ];
      
      const operationInBody = operationPatterns.some(pattern => pattern.test(parsedEnvelope.body || ''));
      
      if (!operationInBody) {
        return { valid: false, error: `Operation ${operationName} not found in SOAP Body` };
      }
      
      // Дополнительная проверка: валидация XML структуры (базовая)
      // Проверяем баланс открывающих и закрывающих тегов
      const openTags = (parsedEnvelope.body.match(/<[^\/][^>]*>/g) || []).length;
      const closeTags = (parsedEnvelope.body.match(/<\/[^>]+>/g) || []).length;
      if (openTags !== closeTags) {
        return { valid: false, error: `XML structure invalid: unbalanced tags (${openTags} open, ${closeTags} close)` };
      }
    }
    
    // 5. Валидация параметров операции (если есть inputMessage в WSDL)
    if (operation.inputMessage && this.config.wsdl.messages) {
      const inputMessage = this.config.wsdl.messages.find(m => m.name === operation.inputMessage);
      if (inputMessage && parsedEnvelope.body) {
        // Проверяем наличие обязательных частей сообщения
        for (const part of inputMessage.parts) {
          // Упрощенная проверка - в реальности нужна полная валидация XML против XSD
          if (part.name && !parsedEnvelope.body.includes(part.name)) {
            // Не критично - может быть опциональным параметром
            // return { valid: false, error: `Required parameter ${part.name} not found in request` };
          }
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Парсит WSDL из XML строки
   */
  public parseWSDL(wsdlXml: string): WSDLDefinition | null {
    try {
      const wsdl: WSDLDefinition = {
        services: [],
        types: [],
        messages: [],
        portTypes: [],
        bindings: [],
      };
      
      // Извлекаем targetNamespace
      const targetNamespaceMatch = wsdlXml.match(/targetNamespace=["']([^"']+)["']/);
      if (targetNamespaceMatch) {
        wsdl.targetNamespace = targetNamespaceMatch[1];
      }
      
      // Парсим types (упрощенный)
      const typesMatch = wsdlXml.match(/<wsdl:types[^>]*>(.*?)<\/wsdl:types>/is);
      if (typesMatch) {
        // В реальности нужно парсить XSD схемы внутри types
        // Здесь упрощенная версия
      }
      
      // Парсим messages
      const messageRegex = /<wsdl:message[^>]*name=["']([^"']+)["'][^>]*>(.*?)<\/wsdl:message>/gis;
      let messageMatch;
      while ((messageMatch = messageRegex.exec(wsdlXml)) !== null) {
        const messageName = messageMatch[1];
        const messageContent = messageMatch[2];
        const parts: Array<{ name: string; type: string }> = [];
        
        // Парсим parts
        const partRegex = /<wsdl:part[^>]*name=["']([^"']+)["'][^>]*(?:type=["']([^"']+)["']|element=["']([^"']+)["'])/gi;
        let partMatch;
        while ((partMatch = partRegex.exec(messageContent)) !== null) {
          parts.push({
            name: partMatch[1],
            type: partMatch[2] || partMatch[3] || 'string',
          });
        }
        
        wsdl.messages?.push({
          name: messageName,
          parts,
        });
      }
      
      // Парсим portTypes
      const portTypeRegex = /<wsdl:portType[^>]*name=["']([^"']+)["'][^>]*>(.*?)<\/wsdl:portType>/gis;
      let portTypeMatch;
      while ((portTypeMatch = portTypeRegex.exec(wsdlXml)) !== null) {
        const portTypeName = portTypeMatch[1];
        const portTypeContent = portTypeMatch[2];
        const operations: Array<{
          name: string;
          input?: string;
          output?: string;
          faults?: string[];
        }> = [];
        
        // Парсим operations
        const operationRegex = /<wsdl:operation[^>]*name=["']([^"']+)["'][^>]*>(.*?)<\/wsdl:operation>/gis;
        let operationMatch;
        while ((operationMatch = operationRegex.exec(portTypeContent)) !== null) {
          const opName = operationMatch[1];
          const opContent = operationMatch[2];
          
          const inputMatch = opContent.match(/<wsdl:input[^>]*(?:message=["']([^"']+)["']|name=["']([^"']+)["'])/i);
          const outputMatch = opContent.match(/<wsdl:output[^>]*(?:message=["']([^"']+)["']|name=["']([^"']+)["'])/i);
          const faultMatches = opContent.matchAll(/<wsdl:fault[^>]*(?:message=["']([^"']+)["']|name=["']([^"']+)["'])/gi);
          
          const faults: string[] = [];
          for (const faultMatch of faultMatches) {
            faults.push(faultMatch[1] || faultMatch[2] || '');
          }
          
          operations.push({
            name: opName,
            input: inputMatch?.[1] || inputMatch?.[2],
            output: outputMatch?.[1] || outputMatch?.[2],
            faults: faults.length > 0 ? faults : undefined,
          });
        }
        
        wsdl.portTypes?.push({
          name: portTypeName,
          operations,
        });
      }
      
      // Парсим bindings
      const bindingRegex = /<wsdl:binding[^>]*name=["']([^"']+)["'][^>]*(?:type=["']([^"']+)["'])/gi;
      let bindingMatch;
      while ((bindingMatch = bindingRegex.exec(wsdlXml)) !== null) {
        const bindingName = bindingMatch[1];
        const bindingType = bindingMatch[2];
        
        // Определяем style и transport
        const styleMatch = wsdlXml.match(new RegExp(`<wsdl:binding[^>]*name=["']${bindingName}["'][^>]*>.*?<soap:binding[^>]*style=["']([^"']+)["']`, 'is'));
        const transportMatch = wsdlXml.match(new RegExp(`<wsdl:binding[^>]*name=["']${bindingName}["'][^>]*>.*?<soap:binding[^>]*transport=["']([^"']+)["']`, 'is'));
        
        wsdl.bindings?.push({
          name: bindingName,
          type: bindingType,
          style: styleMatch?.[1] as 'document' | 'rpc' | undefined,
          transport: transportMatch?.[1],
        });
      }
      
      // Парсим services
      const serviceRegex = /<wsdl:service[^>]*name=["']([^"']+)["'][^>]*>(.*?)<\/wsdl:service>/gis;
      let serviceMatch;
      while ((serviceMatch = serviceRegex.exec(wsdlXml)) !== null) {
        const serviceName = serviceMatch[1];
        const serviceContent = serviceMatch[2];
        
        // Парсим ports
        const portRegex = /<wsdl:port[^>]*name=["']([^"']+)["'][^>]*>.*?<soap:address[^>]*location=["']([^"']+)["']/gis;
        const portMatch = portRegex.exec(serviceContent);
        
        const portName = portMatch?.[1] || 'default';
        const endpoint = portMatch?.[2] || '';
        
        // Находим операции для этого сервиса через binding
        const operations: SOAPOperation[] = [];
        // Упрощенная версия - в реальности нужно связать service -> port -> binding -> portType -> operations
        
        wsdl.services?.push({
          name: serviceName,
          port: portName,
          operations,
          endpoint,
        });
      }
      
      return wsdl;
    } catch (error) {
      console.error('Failed to parse WSDL:', error);
      return null;
    }
  }
  
  /**
   * Генерирует WSDL из конфигурации компонента
   */
  public generateWSDL(): string {
    if (!this.config || !this.config.services || this.config.services.length === 0) {
      return '';
    }
    
    const soapVersion = this.config.soapVersion || '1.1';
    const soapNamespace = soapVersion === '1.1' 
      ? 'http://schemas.xmlsoap.org/soap/envelope/'
      : 'http://www.w3.org/2003/05/soap-envelope';
    const soapBindingNamespace = soapVersion === '1.1'
      ? 'http://schemas.xmlsoap.org/wsdl/soap/'
      : 'http://schemas.xmlsoap.org/wsdl/soap12/';
    
    const targetNamespace = this.config.wsdl?.targetNamespace || 'http://tempuri.org/';
    const endpoint = this.config.endpoint || '/soap';
    
    let wsdl = `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                  xmlns:soap="${soapBindingNamespace}"
                  xmlns:tns="${targetNamespace}"
                  targetNamespace="${targetNamespace}">
  
  <wsdl:types>
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="${targetNamespace}">
`;
    
    // Генерируем типы для операций
    for (const service of this.config.services) {
      for (const operation of service.operations) {
        wsdl += `      <xs:element name="${operation.name}Request">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="input" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="${operation.name}Response">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="output" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
`;
      }
    }
    
    wsdl += `    </xs:schema>
  </wsdl:types>
`;
    
    // Генерируем messages
    for (const service of this.config.services) {
      for (const operation of service.operations) {
        wsdl += `  <wsdl:message name="${operation.name}Request">
    <wsdl:part name="parameters" element="tns:${operation.name}Request"/>
  </wsdl:message>
  <wsdl:message name="${operation.name}Response">
    <wsdl:part name="parameters" element="tns:${operation.name}Response"/>
  </wsdl:message>
`;
      }
    }
    
    // Генерируем portTypes
    for (const service of this.config.services) {
      wsdl += `  <wsdl:portType name="${service.name}PortType">
`;
      for (const operation of service.operations) {
        wsdl += `    <wsdl:operation name="${operation.name}">
      <wsdl:input message="tns:${operation.name}Request"/>
      <wsdl:output message="tns:${operation.name}Response"/>
`;
        if (operation.faults && operation.faults.length > 0) {
          for (const fault of operation.faults) {
            wsdl += `      <wsdl:fault name="${fault}" message="tns:${fault}"/>
`;
          }
        }
        wsdl += `    </wsdl:operation>
`;
      }
      wsdl += `  </wsdl:portType>
`;
    }
    
    // Генерируем bindings
    for (const service of this.config.services) {
      wsdl += `  <wsdl:binding name="${service.name}Binding" type="tns:${service.name}PortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
`;
      for (const operation of service.operations) {
        wsdl += `    <wsdl:operation name="${operation.name}">
      <soap:operation soapAction="${targetNamespace}${operation.name}"/>
      <wsdl:input>
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output>
        <soap:body use="literal"/>
      </wsdl:output>
    </wsdl:operation>
`;
      }
      wsdl += `  </wsdl:binding>
`;
    }
    
    // Генерируем services
    for (const service of this.config.services) {
      wsdl += `  <wsdl:service name="${service.name}">
    <wsdl:port name="${service.port || 'default'}" binding="tns:${service.name}Binding">
      <soap:address location="${endpoint}"/>
    </wsdl:port>
  </wsdl:service>
`;
    }
    
    wsdl += `</wsdl:definitions>`;
    
    return wsdl;
  }
  
  /**
   * Загружает WSDL из URL или строки
   */
  public async loadWSDL(wsdlSource: string): Promise<WSDLDefinition | null> {
    try {
      // Если это URL, нужно было бы сделать fetch, но в симуляции просто парсим как XML
      // В реальности: const response = await fetch(wsdlSource); const wsdlXml = await response.text();
      
      // Для симуляции считаем, что wsdlSource - это XML строка
      const wsdl = this.parseWSDL(wsdlSource);
      
      if (wsdl) {
        // Обновляем конфигурацию с загруженным WSDL
        if (this.config) {
          this.config.wsdl = wsdl;
          
          // Синхронизируем services из WSDL с конфигурацией
          if (wsdl.services) {
            this.config.services = wsdl.services.map(wsdlService => ({
              name: wsdlService.name,
              port: wsdlService.port,
              operations: wsdlService.operations,
              wsdlUrl: this.config?.wsdlUrl,
              endpoint: wsdlService.endpoint,
            }));
          }
        }
      }
      
      return wsdl;
    } catch (error) {
      console.error('Failed to load WSDL:', error);
      return null;
    }
  }
  
  /**
   * Валидирует WS-Security
   */
  private validateWSSecurity(
    headers: Record<string, string>,
    envelope: string
  ): { valid: boolean; error?: string } {
    // Симуляция проверки WS-Security
    // В реальности нужно проверять XML Signature и XML Encryption
    
    if (!headers['Security']) {
      return { valid: false, error: 'WS-Security header not found' };
    }
    
    // Симулируем проверку подписи
    // В реальности: проверка XML Signature, проверка сертификата, проверка временных меток
    const hasSignature = headers['Security'].includes('Signature') || 
                        envelope.includes('<ds:Signature') ||
                        envelope.includes('<wsse:Signature');
    
    if (!hasSignature) {
      return { valid: false, error: 'WS-Security signature not found' };
    }
    
    // Симулируем проверку шифрования (если есть)
    const hasEncryption = headers['Security'].includes('EncryptedData') ||
                          envelope.includes('<xenc:EncryptedData');
    
    // Симулируем успешную валидацию (в реальности нужна реальная проверка)
    // 95% успешных проверок, 5% ошибок для симуляции
    const validationSuccess = Math.random() > 0.05;
    
    if (!validationSuccess) {
      return { valid: false, error: 'WS-Security signature validation failed' };
    }
    
    return { valid: true };
  }
  
  /**
   * Обрабатывает WS-Addressing заголовки
   */
  private processWSAddressing(
    headers: Record<string, string>
  ): { success: boolean; error?: string; messageId?: string; replyTo?: string } {
    // Симуляция обработки WS-Addressing
    
    const messageId = headers['MessageID'];
    const replyTo = headers['ReplyTo'];
    const to = headers['To'];
    const from = headers['From'];
    const action = headers['Action'];
    
    // Проверяем обязательные заголовки для WS-Addressing
    if (!messageId) {
      return { success: false, error: 'WS-Addressing MessageID is required' };
    }
    
    if (!to) {
      return { success: false, error: 'WS-Addressing To is required' };
    }
    
    if (!action) {
      return { success: false, error: 'WS-Addressing Action is required' };
    }
    
    // Проверяем формат MessageID (должен быть URI)
    if (!messageId.startsWith('urn:uuid:') && !messageId.startsWith('http://')) {
      return { success: false, error: 'WS-Addressing MessageID must be a valid URI' };
    }
    
    // Симулируем успешную обработку
    return {
      success: true,
      messageId,
      replyTo,
    };
  }
  
  /**
   * Обрабатывает MTOM (Message Transmission Optimization Mechanism)
   */
  private processMTOM(
    body: string
  ): { processed: boolean; body?: string; attachments?: Array<{ id: string; content: string }> } {
    // Симуляция обработки MTOM
    // MTOM оптимизирует передачу бинарных данных через SOAP
    
    // Проверяем наличие MTOM маркеров
    const hasMTOM = body.includes('xop:Include') || 
                    body.includes('href="cid:') ||
                    body.includes('Content-ID:');
    
    if (!hasMTOM) {
      return { processed: false };
    }
    
    // Извлекаем вложения
    const attachments: Array<{ id: string; content: string }> = [];
    
    // Парсим xop:Include элементы
    const xopIncludeRegex = /<xop:Include[^>]*href=["']cid:([^"']+)["'][^>]*\/>/gi;
    let xopMatch;
    while ((xopMatch = xopIncludeRegex.exec(body)) !== null) {
      const attachmentId = xopMatch[1];
      // В реальности нужно извлечь содержимое вложения из MIME multipart
      // Здесь симулируем
      attachments.push({
        id: attachmentId,
        content: `[Binary data for ${attachmentId}]`,
      });
    }
    
    // Заменяем xop:Include на оптимизированное содержимое
    let optimizedBody = body;
    for (const attachment of attachments) {
      // В реальности здесь нужно вставить бинарные данные
      optimizedBody = optimizedBody.replace(
        new RegExp(`<xop:Include[^>]*href=["']cid:${attachment.id}["'][^>]*\/>`, 'gi'),
        `[Optimized binary data: ${attachment.id}]`
      );
    }
    
    return {
      processed: true,
      body: optimizedBody,
      attachments,
    };
  }
  
  /**
   * Выполняет операцию
   */
  private executeOperation(
    operationName: string,
    serviceName: string,
    body: string,
    nodes?: CanvasNode[],
    connections?: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): { success: boolean; data?: any; error?: string } {
    if (!this.config) {
      return { success: false, error: 'SOAP service not configured' };
    }
    
    // Находим операцию
    const service = this.config.services?.find(s => s.name === serviceName);
    if (!service) {
      return { success: false, error: `Service ${serviceName} not found` };
    }
    
    const operation = service.operations.find(op => op.name === operationName);
    if (!operation || !operation.enabled) {
      return { success: false, error: `Operation ${operationName} not found or disabled` };
    }
    
    // Симулируем выполнение операции
    // Если есть targetService, симулируем запрос к целевому компоненту
    if (operation.targetService && nodes && connections) {
      return this.simulateTargetServiceCall(operation, body, nodes, connections, traceContext, getJaegerEngines);
    }
    
    // Иначе возвращаем успешный ответ с симулированными данными
    const latency = operation.latency || this.config.responseLatency || 50;
    return {
      success: true,
      data: this.generateMockResponseData(operationName),
    };
  }
  
  /**
   * Симулирует вызов целевого сервиса через DataFlowEngine
   */
  private simulateTargetServiceCall(
    operation: SOAPOperation,
    body: string,
    nodes: CanvasNode[],
    connections: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): { success: boolean; data?: any; error?: string } {
    if (!operation.targetService) {
      return { success: false, error: 'No target service specified' };
    }
    
    // Находим целевой компонент
    const targetNode = nodes.find(n => n.id === operation.targetService);
    if (!targetNode) {
      return { success: false, error: `Target service ${operation.targetService} not found` };
    }
    
    // Находим соединение между SOAP компонентом и целевым компонентом
    const connection = connections.find(
      c => c.source === this.componentId && c.target === operation.targetService
    );
    
    if (!connection) {
      // Если нет прямого соединения, используем моковые данные
      const targetLatency = operation.latency || 50;
      return {
        success: true,
        data: this.generateMockResponseData(operation.name),
      };
    }
    
    // Если есть функция для отправки сообщений, используем её
    if (this.sendMessageToTarget && this.componentId) {
      try {
        // Создаем сообщение для отправки к целевому компоненту
        const message: DataMessage = {
          id: `soap-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          source: this.componentId,
          target: operation.targetService,
          connectionId: connection.id,
          format: 'xml',
          payload: {
            envelope: body,
            operation: operation.name,
            soapVersion: this.config?.soapVersion || '1.1',
          },
          size: Buffer.byteLength(body, 'utf8'),
          metadata: {
            contentType: 'application/soap+xml',
            traceContext: traceContext,
          },
          status: 'pending',
        };
        
        // Отправляем сообщение синхронно (в реальности это должно быть асинхронно)
        // Для симуляции используем Promise.resolve с задержкой
        const sendStartTime = Date.now();
        const targetLatency = operation.latency || this.getTargetComponentLatency(targetNode);
        
        // Симулируем отправку и получение ответа
        // В реальной реализации это должно быть через DataFlowEngine
        const responseData = this.simulateTargetResponse(targetNode, body, operation.name);
        
        // Учитываем latency целевого компонента
        const simulatedLatency = targetLatency;
        
        return {
          success: true,
          data: responseData,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to call target service',
        };
      }
    }
    
    // Fallback: используем моковые данные
    const targetLatency = operation.latency || 50;
    return {
      success: true,
      data: this.generateMockResponseData(operation.name),
    };
  }
  
  /**
   * Получает latency целевого компонента из его метрик
   */
  private getTargetComponentLatency(targetNode: CanvasNode): number {
    // Пытаемся получить метрики целевого компонента из emulationEngine
    // Это упрощенная версия - в реальности нужно получать из EmulationEngine
    const defaultLatencies: Record<string, number> = {
      'postgresql': 10,
      'mysql': 15,
      'mongodb': 20,
      'redis': 5,
      'rest': 50,
      'graphql': 60,
      'grpc': 30,
    };
    
    return defaultLatencies[targetNode.type] || 50;
  }
  
  /**
   * Симулирует ответ от целевого компонента
   */
  private simulateTargetResponse(targetNode: CanvasNode, body: string, operationName: string): any {
    // В зависимости от типа целевого компонента генерируем разные ответы
    switch (targetNode.type) {
      case 'postgresql':
      case 'mysql':
        // Симулируем ответ от БД
        return {
          rows: [
            { id: 1, name: 'Result 1', value: 100 },
            { id: 2, name: 'Result 2', value: 200 },
          ],
          count: 2,
        };
      case 'mongodb':
        return {
          documents: [
            { _id: '1', data: 'Result 1' },
            { _id: '2', data: 'Result 2' },
          ],
        };
      case 'rest':
      case 'graphql':
        return {
          data: {
            result: `Response from ${targetNode.type} for ${operationName}`,
            timestamp: Date.now(),
          },
        };
      default:
        return this.generateMockResponseData(operationName);
    }
  }
  
  /**
   * Генерирует моковые данные ответа
   */
  private generateMockResponseData(operationName: string): any {
    return {
      result: `Response from ${operationName}`,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Создает успешный SOAP ответ
   */
  private createSuccessResponse(
    operationName: string,
    data: any,
    soapVersion: '1.1' | '1.2',
    latency: number,
    wsAddressingHeaders?: Record<string, string>
  ): SOAPResponse {
    const namespace = soapVersion === '1.1' 
      ? 'http://schemas.xmlsoap.org/soap/envelope/'
      : 'http://www.w3.org/2003/05/soap-envelope';
    
    let header = '';
    if (this.config?.enableWSAddressing && wsAddressingHeaders) {
      // Генерируем новый MessageID для ответа
      const responseMessageId = `urn:uuid:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const relatesTo = wsAddressingHeaders['MessageID'] || '';
      
      header = `  <soap:Header>
    <wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">${responseMessageId}</wsa:MessageID>
    <wsa:RelatesTo xmlns:wsa="http://www.w3.org/2005/08/addressing">${relatesTo}</wsa:RelatesTo>
    <wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing">${wsAddressingHeaders['ReplyTo'] || wsAddressingHeaders['From'] || 'http://www.w3.org/2005/08/addressing/anonymous'}</wsa:To>
    <wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing">${wsAddressingHeaders['Action']?.replace('Request', 'Response') || `${this.config.wsdl?.targetNamespace || 'http://tempuri.org/'}${operationName}Response`}</wsa:Action>
  </soap:Header>
`;
    }
    
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${namespace}">
${header}  <soap:Body>
    <${operationName}Response>
      ${this.serializeDataToXML(data)}
    </${operationName}Response>
  </soap:Body>
</soap:Envelope>`;
    
    return {
      envelope,
      status: 200,
      latency,
      success: true,
    };
  }
  
  /**
   * Создает SOAP Fault ответ
   */
  private createFaultResponse(
    code: string,
    message: string,
    latency: number,
    soapVersion: '1.1' | '1.2' = '1.1'
  ): SOAPResponse {
    const namespace = soapVersion === '1.1' 
      ? 'http://schemas.xmlsoap.org/soap/envelope/'
      : 'http://www.w3.org/2003/05/soap-envelope';
    
    const fault: SOAPFault = {
      code,
      string: message,
    };
    
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${namespace}">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:${code}</faultcode>
      <faultstring>${message}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
    
    return {
      envelope,
      status: 500,
      latency,
      success: false,
      fault,
    };
  }
  
  /**
   * Создает ответ с ошибкой
   */
  private createErrorResponse(message: string, status: number, startTime: number): SOAPResponse {
    return {
      envelope: '',
      status,
      latency: Date.now() - startTime,
      success: false,
      error: message,
    };
  }
  
  /**
   * Сериализует данные в XML
   */
  private serializeDataToXML(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `<${key}>${this.serializeDataToXML(value)}</${key}>`)
        .join('');
    }
    return String(data);
  }
  
  /**
   * Генерирует ключ кэша
   */
  private generateCacheKey(envelope: string, operation: string): string {
    // Упрощенный ключ (в реальности нужно учитывать все параметры)
    return `${operation}:${envelope.substring(0, 100)}`;
  }
  
  /**
   * Записывает запрос в метрики
   */
  private recordRequest(operationName: string, serviceName: string, latency: number, success: boolean): void {
    const now = Date.now();
    
    // Обновляем общие метрики
    this.soapMetrics.totalRequests++;
    if (!success) {
      this.soapMetrics.totalErrors++;
    }
    
    // Обновляем latency history
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
    
    // Обновляем среднюю latency
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.soapMetrics.averageLatency = sum / this.latencyHistory.length;
    this.soapMetrics.averageResponseTime = this.soapMetrics.averageLatency;
    
    // Обновляем error rate
    this.soapMetrics.errorRate = this.soapMetrics.totalRequests > 0
      ? (this.soapMetrics.totalErrors / this.soapMetrics.totalRequests) * 100
      : 0;
    this.soapMetrics.successRate = 100 - this.soapMetrics.errorRate;
    
    // Обновляем RPS и тренды
    if (now - this.lastSecondStart >= 1000) {
      this.previousRPS = this.soapMetrics.requestsPerSecond;
      this.soapMetrics.requestsPerSecond = this.requestsThisSecond;
      
      // Обновляем историю throughput
      this.throughputHistory.push(this.requestsThisSecond);
      if (this.throughputHistory.length > this.MAX_THROUGHPUT_HISTORY) {
        this.throughputHistory.shift();
      }
      
      // Обновляем пик
      if (this.requestsThisSecond > this.peakRPS) {
        this.peakRPS = this.requestsThisSecond;
        this.peakRPSTime = now;
      }
      
      // Вычисляем тренд
      const changePercent = this.previousRPS > 0 
        ? ((this.requestsThisSecond - this.previousRPS) / this.previousRPS) * 100 
        : 0;
      const trend: 'increasing' | 'decreasing' | 'stable' = 
        changePercent > 5 ? 'increasing' :
        changePercent < -5 ? 'decreasing' :
        'stable';
      
      this.soapMetrics.throughputTrends = {
        current: this.requestsThisSecond,
        previous: this.previousRPS,
        trend,
        changePercent,
        peak: this.peakRPS,
        peakTime: this.peakRPSTime,
      };
      
      this.requestsThisSecond = 0;
      this.lastSecondStart = now;
    } else {
      this.requestsThisSecond++;
    }
    
    // Обновляем метрики операции
    const operationKey = `${serviceName}:${operationName}`;
    const operationMetric = this.operationMetrics.get(operationKey);
    if (operationMetric) {
      operationMetric.totalCalls++;
      if (!success) {
        operationMetric.totalErrors++;
      }
      operationMetric.totalLatency += latency;
      operationMetric.averageLatency = operationMetric.totalLatency / operationMetric.totalCalls;
      operationMetric.minLatency = Math.min(operationMetric.minLatency, latency);
      operationMetric.maxLatency = Math.max(operationMetric.maxLatency, latency);
      operationMetric.lastCallTime = now;
      operationMetric.errorRate = operationMetric.totalCalls > 0
        ? (operationMetric.totalErrors / operationMetric.totalCalls) * 100
        : 0;
      
      // Обновляем calls per second
      const callsThisSecond = this.operationCallsThisSecond.get(operationKey) || 0;
      this.operationCallsThisSecond.set(operationKey, callsThisSecond + 1);
    }
    
    // Обновляем метрики сервиса
    const serviceMetric = this.serviceMetrics.get(serviceName);
    if (serviceMetric) {
      serviceMetric.totalRequests++;
      if (!success) {
        serviceMetric.totalErrors++;
      }
      serviceMetric.averageLatency = ((serviceMetric.averageLatency * (serviceMetric.totalRequests - 1)) + latency) / serviceMetric.totalRequests;
      serviceMetric.errorRate = serviceMetric.totalRequests > 0
        ? (serviceMetric.totalErrors / serviceMetric.totalRequests) * 100
        : 0;
      
      // Обновляем requests per second
      const requestsThisSecond = this.serviceRequestsThisSecond.get(serviceName) || 0;
      this.serviceRequestsThisSecond.set(serviceName, requestsThisSecond + 1);
    }
    
    // Сохраняем в историю
    const request: SOAPRequest = {
      id: `req-${Date.now()}-${Math.random()}`,
      operation: operationName,
      service: serviceName,
      envelope: '', // Не сохраняем полный envelope для экономии памяти
      timestamp: now,
      duration: latency,
      success,
    };
    
    this.requestHistory.push(request);
    if (this.requestHistory.length > this.MAX_HISTORY_SIZE) {
      this.requestHistory.shift();
    }
  }
  
  /**
   * Записывает ошибку
   */
  private recordError(category: ErrorCategory, message: string, operationName?: string, serviceName?: string): void {
    const now = Date.now();
    
    // Обновляем метрики ошибок
    let errorMetric = this.errorMetrics.get(category);
    if (!errorMetric) {
      errorMetric = {
        category,
        totalErrors: 0,
        errorsPerSecond: 0,
      };
      this.errorMetrics.set(category, errorMetric);
    }
    
    errorMetric.totalErrors++;
    errorMetric.lastErrorTime = now;
    
    // Обновляем errors per second
    const errorsThisSecond = this.errorCountsThisSecond.get(category) || 0;
    this.errorCountsThisSecond.set(category, errorsThisSecond + 1);
    
    // Сохраняем в историю
    this.errorHistory.push({
      timestamp: now,
      category,
      message,
      operationName,
      serviceName,
    });
    
    if (this.errorHistory.length > this.MAX_TOTAL_ERROR_HISTORY) {
      this.errorHistory.shift();
    }
  }
  
  /**
   * Проверяет rate limit
   */
  private checkRateLimit(clientId: string): boolean {
    if (!this.config?.rateLimit?.enabled) {
      return true;
    }
    
    const key = clientId;
    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs || 1000;
    const limit = this.config.rateLimit.requestsPerSecond || 1000;
    
    let counter = this.rateLimitCounters.get(key);
    if (!counter || now >= counter.resetAt) {
      counter = {
        count: 0,
        resetAt: now + windowMs,
        windowStart: now,
      };
      this.rateLimitCounters.set(key, counter);
    }
    
    if (counter.count >= limit) {
      this.rateLimitMetrics.totalBlockedRequests++;
      this.rateLimitHitsThisSecond++;
      return false;
    }
    
    counter.count++;
    return true;
  }
  
  /**
   * Получает идентификатор клиента
   */
  private getClientIdentifier(clientIP?: string, headers?: Record<string, string>): string {
    const identifyBy = this.config?.rateLimit?.identifyBy || 'ip';
    
    if (identifyBy === 'ip' && clientIP) {
      return `ip:${clientIP}`;
    }
    
    if (identifyBy === 'apiKey' && headers?.['X-API-Key']) {
      return `apikey:${headers['X-API-Key']}`;
    }
    
    if (identifyBy === 'user' && headers?.['X-User-Id']) {
      return `user:${headers['X-User-Id']}`;
    }
    
    return 'default';
  }
  
  /**
   * Создает span для запроса
   */
  private createRequestSpan(
    operationName: string,
    startTime: number,
    getJaegerEngines?: () => Map<string, any>
  ): TraceContext | undefined {
    if (!getJaegerEngines) return undefined;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return undefined;
    
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const traceContext: TraceContext = {
      traceId,
      spanId,
      parentSpanId: undefined,
    };
    
    this.traceContexts.set(traceId, traceContext);
    
    return traceContext;
  }
  
  /**
   * Завершает span запроса
   */
  private finishRequestSpan(
    traceContext: TraceContext | undefined,
    startTime: number,
    endTime: number,
    success: boolean,
    error?: string,
    getJaegerEngines?: () => Map<string, any>
  ): void {
    if (!traceContext || !getJaegerEngines) return;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return;
    
    const duration = (endTime - startTime) * 1000; // convert to microseconds
    const startTimeMicros = startTime * 1000; // convert to microseconds
    
    const span: JaegerSpan = {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId,
      operationName: 'soap.request',
      serviceName: this.componentId || 'soap',
      startTime: startTimeMicros,
      duration,
      tags: [
        { key: 'component.type', value: 'soap' },
        { key: 'soap.operation', value: 'unknown' },
        { key: 'status', value: success ? 'success' : 'error' },
      ],
      logs: [],
    };
    
    if (error) {
      span.tags.push({ key: 'error', value: true });
      span.logs.push({
        timestamp: startTimeMicros + duration,
        fields: [
          { key: 'event', value: 'error' },
          { key: 'error.message', value: error },
        ],
      });
    }
    
    // Отправляем span во все Jaeger engines
    for (const engine of jaegerEngines.values()) {
      if (engine && typeof engine.addSpan === 'function') {
        engine.addSpan(span);
      }
    }
  }
  
  /**
   * Генерирует trace ID
   */
  private generateTraceId(): string {
    return `trace-${++this.traceIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Генерирует span ID
   */
  private generateSpanId(): string {
    return `span-${++this.spanIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Вычисляет перцентиль из отсортированного массива
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
  
  /**
   * Обновляет распределение размеров запросов
   */
  private updateRequestSizeDistribution(): void {
    // Разбиваем на диапазоны: 0-1KB, 1-5KB, 5-10KB, 10-50KB, 50-100KB, 100KB+
    const ranges = [
      { range: '0-1KB', min: 0, max: 1024 },
      { range: '1-5KB', min: 1024, max: 5 * 1024 },
      { range: '5-10KB', min: 5 * 1024, max: 10 * 1024 },
      { range: '10-50KB', min: 10 * 1024, max: 50 * 1024 },
      { range: '50-100KB', min: 50 * 1024, max: 100 * 1024 },
      { range: '100KB+', min: 100 * 1024, max: Infinity },
    ];
    
    // Подсчитываем запросы по диапазонам (упрощенная версия - в реальности нужна история размеров)
    // Здесь используем текущие метрики для оценки
    const distribution = ranges.map(range => ({
      range: range.range,
      count: 0, // В реальности нужно хранить историю размеров
    }));
    
    this.requestSizeMetrics.sizeDistribution = distribution;
  }
  
  /**
   * Обновляет per-second метрики
   */
  private updateMetricsPerSecond(): void {
    const now = Date.now();
    if (now - this.lastMetricsSecondStart < 1000) return;
    
    // Обновляем метрики операций
    for (const [key, calls] of this.operationCallsThisSecond.entries()) {
      const metric = this.operationMetrics.get(key);
      if (metric) {
        metric.callsPerSecond = calls;
      }
    }
    this.operationCallsThisSecond.clear();
    
    // Обновляем метрики сервисов
    for (const [serviceName, requests] of this.serviceRequestsThisSecond.entries()) {
      const metric = this.serviceMetrics.get(serviceName);
      if (metric) {
        metric.requestsPerSecond = requests;
      }
    }
    this.serviceRequestsThisSecond.clear();
    
    // Обновляем метрики ошибок
    for (const [category, errors] of this.errorCountsThisSecond.entries()) {
      const metric = this.errorMetrics.get(category);
      if (metric) {
        metric.errorsPerSecond = errors;
      }
    }
    this.errorCountsThisSecond.clear();
    
    // Обновляем rate limit метрики
    if (now - this.lastRateLimitSecondStart >= 1000) {
      this.rateLimitMetrics.blockedRequestsPerSecond = this.blockedRequestsThisSecond;
      this.rateLimitMetrics.rateLimitHitsPerSecond = this.rateLimitHitsThisSecond;
      this.blockedRequestsThisSecond = 0;
      this.rateLimitHitsThisSecond = 0;
      this.lastRateLimitSecondStart = now;
    }
    
    // Обновляем timeout метрики
    if (now - this.lastTimeoutSecondStart >= 1000) {
      this.timeoutMetrics.timeoutsPerSecond = this.timeoutsThisSecond;
      this.timeoutsThisSecond = 0;
      this.lastTimeoutSecondStart = now;
    }
    
    this.lastMetricsSecondStart = now;
  }
  
  /**
   * Получить метрики SOAP
   */
  public getSOAPMetrics(): SOAPMetrics {
    // Обновляем per-second метрики перед возвратом
    this.updateMetricsPerSecond();
    
    // Обновляем распределение размеров
    this.updateRequestSizeDistribution();
    
    // Вычисляем latency percentiles
    const sortedLatencies = [...this.latencyHistory].sort((a, b) => a - b);
    const latencyP50 = sortedLatencies.length > 0 ? this.calculatePercentile(sortedLatencies, this.PERCENTILE_P50) : undefined;
    const latencyP95 = sortedLatencies.length > 0 ? this.calculatePercentile(sortedLatencies, this.PERCENTILE_P95) : undefined;
    const latencyP99 = sortedLatencies.length > 0 ? this.calculatePercentile(sortedLatencies, this.PERCENTILE_P99) : undefined;
    
    return {
      ...this.soapMetrics,
      latencyP50,
      latencyP95,
      latencyP99,
      operationMetrics: Array.from(this.operationMetrics.values()),
      serviceMetrics: Array.from(this.serviceMetrics.values()),
      errorMetrics: Array.from(this.errorMetrics.values()),
      rateLimitMetrics: { ...this.rateLimitMetrics },
      timeoutMetrics: { ...this.timeoutMetrics },
      wsSecurityMetrics: { ...this.wsSecurityMetrics },
      wsAddressingMetrics: { ...this.wsAddressingMetrics },
      mtomMetrics: { ...this.mtomMetrics },
      requestSizeMetrics: { ...this.requestSizeMetrics },
      throughputTrends: this.soapMetrics.throughputTrends,
    };
  }
  
  /**
   * Сброс метрик
   */
  public resetMetrics(): void {
    this.soapMetrics = {
      requestsPerSecond: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      totalErrors: 0,
      errorRate: 0,
      successRate: 0,
      averageLatency: 0,
    };
    
    this.requestHistory = [];
    this.latencyHistory = [];
    this.operationMetrics.clear();
    this.serviceMetrics.clear();
    this.errorMetrics.clear();
    this.errorHistory = [];
    this.rateLimitMetrics = {
      totalBlockedRequests: 0,
      blockedRequestsPerSecond: 0,
      totalRateLimitHits: 0,
      rateLimitHitsPerSecond: 0,
    };
    this.timeoutMetrics = {
      totalTimeouts: 0,
      timeoutsPerSecond: 0,
    };
    this.wsSecurityMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      validationSuccessRate: 0,
      signaturesProcessed: 0,
      encryptionsProcessed: 0,
    };
    this.wsAddressingMetrics = {
      totalMessages: 0,
      messagesWithAddressing: 0,
      asyncResponses: 0,
      addressingUsageRate: 0,
    };
    this.mtomMetrics = {
      totalMessages: 0,
      messagesWithMTOM: 0,
      totalAttachments: 0,
      averageAttachmentsPerMessage: 0,
      mtomUsageRate: 0,
    };
    this.requestSizeMetrics = {
      totalRequests: 0,
      averageRequestSize: 0,
      minRequestSize: Infinity,
      maxRequestSize: 0,
      totalBytesReceived: 0,
      totalBytesSent: 0,
      averageResponseSize: 0,
      sizeDistribution: [],
    };
    this.throughputHistory = [];
    this.previousRPS = 0;
    this.peakRPS = 0;
    this.peakRPSTime = 0;
    this.requestCache.clear();
  }
  
  /**
   * Получить историю throughput
   */
  public getThroughputHistory(limit: number = 60): number[] {
    return this.throughputHistory.slice(-limit);
  }
  
  /**
   * Получить историю latency
   */
  public getLatencyHistory(limit: number = 500): number[] {
    return this.latencyHistory.slice(-limit);
  }
  
  /**
   * Получить историю запросов
   */
  public getRequestHistory(limit: number = 100): SOAPRequest[] {
    return this.requestHistory.slice(-limit);
  }
  
  /**
   * Получить метрики операции
   */
  public getOperationMetrics(serviceName: string, operationName: string): OperationMetrics | undefined {
    return this.operationMetrics.get(`${serviceName}:${operationName}`);
  }
  
  /**
   * Получить метрики сервиса
   */
  public getServiceMetrics(serviceName: string): ServiceMetrics | undefined {
    return this.serviceMetrics.get(serviceName);
  }
  
  /**
   * Получить историю ошибок
   */
  public getErrorHistory(limit: number = 100): Array<{
    timestamp: number;
    category: ErrorCategory;
    message: string;
    operationName?: string;
    serviceName?: string;
  }> {
    return this.errorHistory.slice(-limit);
  }
  
  /**
   * Получить WSDL определение
   */
  public getWSDL(): WSDLDefinition | undefined {
    return this.config?.wsdl;
  }
  
  /**
   * Установить WSDL определение
   */
  public setWSDL(wsdl: WSDLDefinition): void {
    if (this.config) {
      this.config.wsdl = wsdl;
      
      // Синхронизируем services из WSDL
      if (wsdl.services) {
        this.config.services = wsdl.services.map(wsdlService => ({
          name: wsdlService.name,
          port: wsdlService.port,
          operations: wsdlService.operations,
          wsdlUrl: this.config?.wsdlUrl,
          endpoint: wsdlService.endpoint,
        }));
        
        // Инициализируем метрики для новых сервисов
        for (const service of wsdl.services) {
          this.initializeServiceMetrics(service.name);
          for (const operation of service.operations) {
            this.initializeOperationMetrics(service.name, operation.name);
          }
        }
      }
    }
  }
  
  /**
   * Получить сгенерированный WSDL в виде XML строки
   */
  public getWSDLXML(): string {
    return this.generateWSDL();
  }
  
  /**
   * Валидировать WSDL
   */
  public validateWSDL(wsdl: WSDLDefinition): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!wsdl.services || wsdl.services.length === 0) {
      errors.push('WSDL must contain at least one service');
    }
    
    for (const service of wsdl.services || []) {
      if (!service.name) {
        errors.push('Service must have a name');
      }
      
      if (!service.operations || service.operations.length === 0) {
        errors.push(`Service ${service.name} must have at least one operation`);
      }
      
      for (const operation of service.operations) {
        if (!operation.name) {
          errors.push(`Operation in service ${service.name} must have a name`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
