import { CanvasNode } from '@/types';

/**
 * CRM Contact Status
 */
export type ContactStatus = 'lead' | 'customer' | 'partner' | 'inactive';

/**
 * CRM Deal Stage
 */
export type DealStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';

/**
 * CRM Account Type
 */
export type AccountType = 'customer' | 'partner' | 'competitor' | 'reseller' | 'prospect';

/**
 * CRM Case Status
 */
export type CaseStatus = 'new' | 'in-progress' | 'escalated' | 'resolved' | 'closed';

/**
 * CRM Case Priority
 */
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * CRM Contact
 */
export interface CRMContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  accountId?: string;
  status: ContactStatus;
  value?: number;
  lastContact?: number; // Timestamp
  createdAt?: number; // Timestamp
  owner?: string;
  tags?: string[];
}

/**
 * CRM Deal/Opportunity
 */
export interface CRMDeal {
  id: string;
  name: string;
  contactId?: string;
  accountId?: string;
  value: number;
  stage: DealStage;
  probability: number; // 0-100
  expectedClose?: number; // Timestamp
  actualClose?: number; // Timestamp
  createdAt?: number; // Timestamp
  owner?: string;
  description?: string;
}

/**
 * CRM Account
 */
export interface CRMAccount {
  id: string;
  name: string;
  type: AccountType;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  annualRevenue?: number;
  employees?: number;
  createdAt?: number; // Timestamp
  owner?: string;
  contacts?: string[]; // Contact IDs
  deals?: string[]; // Deal IDs
}

/**
 * CRM Lead
 */
export interface CRMLead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source?: string; // 'web', 'email', 'phone', 'referral', etc.
  score?: number; // Lead score 0-100
  createdAt?: number; // Timestamp
  owner?: string;
  convertedToContactId?: string;
  convertedToAccountId?: string;
}

/**
 * CRM Case/Ticket
 */
export interface CRMCase {
  id: string;
  subject: string;
  description?: string;
  contactId?: string;
  accountId?: string;
  status: CaseStatus;
  priority: CasePriority;
  type?: string; // 'question', 'problem', 'feature', 'complaint'
  createdAt?: number; // Timestamp
  resolvedAt?: number; // Timestamp
  owner?: string;
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: number;
  }>;
}

/**
 * CRM Activity
 */
export interface CRMActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'note';
  subject: string;
  relatedTo?: string; // Contact/Deal/Account ID
  relatedType?: 'contact' | 'deal' | 'account' | 'case';
  timestamp: number;
  owner?: string;
  duration?: number; // minutes
  status?: 'completed' | 'scheduled' | 'cancelled';
}

/**
 * CRM Configuration
 */
export interface CRMEmulationConfig {
  crmType?: 'salesforce' | 'hubspot' | 'dynamics' | 'custom';
  apiEndpoint?: string;
  enableContacts?: boolean;
  enableLeads?: boolean;
  enableOpportunities?: boolean;
  enableAccounts?: boolean;
  enableCases?: boolean;
  enableReports?: boolean;
  enableWorkflows?: boolean;
  enableIntegrations?: boolean;
  contacts?: CRMContact[];
  deals?: CRMDeal[];
  accounts?: CRMAccount[];
  leads?: CRMLead[];
  cases?: CRMCase[];
  activities?: CRMActivity[];
  // Simulation parameters
  requestsPerSecond?: number; // API requests per second
  averageResponseTime?: number; // milliseconds
  errorRate?: number; // 0-1
  conversionRate?: number; // 0-1, lead to customer conversion
  dealWinRate?: number; // 0-1, deal closed-won rate
  caseResolutionTime?: number; // average hours to resolve case
}

/**
 * CRM Engine Metrics
 */
export interface CRMEngineMetrics {
  // Contacts
  contactsTotal: number;
  contactsLeads: number;
  contactsCustomers: number;
  contactsPartners: number;
  
  // Deals
  dealsTotal: number;
  dealsActive: number;
  dealsWon: number;
  dealsLost: number;
  pipelineValue: number; // Total value of active deals
  wonValue: number; // Total value of won deals
  
  // Accounts
  accountsTotal: number;
  accountsCustomers: number;
  accountsPartners: number;
  
  // Leads
  leadsTotal: number;
  leadsNew: number;
  leadsQualified: number;
  leadsConverted: number;
  
  // Cases
  casesTotal: number;
  casesOpen: number;
  casesResolved: number;
  averageResolutionTime: number; // hours
  
  // Activities
  activitiesTotal: number;
  activitiesToday: number;
  
  // Performance metrics
  requestsPerSecond: number;
  averageResponseTime: number; // milliseconds
  errorRate: number; // 0-1
  conversionRate: number; // 0-1
  dealWinRate: number; // 0-1
  
  // Utilization
  apiUtilization: number; // 0-1
  databaseUtilization: number; // 0-1
}

/**
 * CRM Emulation Engine
 * Симулирует работу CRM системы: контакты, сделки, аккаунты, лиды, кейсы, активности
 */
export class CRMEmulationEngine {
  private config: CRMEmulationConfig | null = null;
  
  // Data stores
  private contacts: Map<string, CRMContact> = new Map();
  private deals: Map<string, CRMDeal> = new Map();
  private accounts: Map<string, CRMAccount> = new Map();
  private leads: Map<string, CRMLead> = new Map();
  private cases: Map<string, CRMCase> = new Map();
  private activities: Map<string, CRMActivity> = new Map();
  
  // Metrics
  private crmMetrics: CRMEngineMetrics = {
    contactsTotal: 0,
    contactsLeads: 0,
    contactsCustomers: 0,
    contactsPartners: 0,
    dealsTotal: 0,
    dealsActive: 0,
    dealsWon: 0,
    dealsLost: 0,
    pipelineValue: 0,
    wonValue: 0,
    accountsTotal: 0,
    accountsCustomers: 0,
    accountsPartners: 0,
    leadsTotal: 0,
    leadsNew: 0,
    leadsQualified: 0,
    leadsConverted: 0,
    casesTotal: 0,
    casesOpen: 0,
    casesResolved: 0,
    averageResolutionTime: 0,
    activitiesTotal: 0,
    activitiesToday: 0,
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    conversionRate: 0,
    dealWinRate: 0,
    apiUtilization: 0,
    databaseUtilization: 0,
  };
  
  // Request history for metrics
  private requestHistory: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private readonly MAX_REQUEST_HISTORY = 1000;
  
  // Last update time
  private lastUpdateTime: number = Date.now();
  
  // Activity generation tracking
  private lastActivityGeneration: number = 0;
  private readonly ACTIVITY_GENERATION_INTERVAL = 5000; // 5 seconds
  
  /**
   * Инициализирует конфигурацию CRM из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      crmType: config.crmType || 'salesforce',
      apiEndpoint: config.apiEndpoint || 'https://api.crm.example.com',
      enableContacts: config.enableContacts ?? true,
      enableLeads: config.enableLeads ?? true,
      enableOpportunities: config.enableOpportunities ?? true,
      enableAccounts: config.enableAccounts ?? true,
      enableCases: config.enableCases ?? true,
      enableReports: config.enableReports ?? true,
      enableWorkflows: config.enableWorkflows ?? true,
      enableIntegrations: config.enableIntegrations ?? true,
      contacts: config.contacts || [],
      deals: config.deals || [],
      accounts: config.accounts || [],
      leads: config.leads || [],
      cases: config.cases || [],
      activities: config.activities || [],
      requestsPerSecond: config.requestsPerSecond || 10,
      averageResponseTime: config.averageResponseTime || 150,
      errorRate: config.errorRate || 0.02,
      conversionRate: config.conversionRate || 0.15,
      dealWinRate: config.dealWinRate || 0.25,
      caseResolutionTime: config.caseResolutionTime || 24, // hours
    };
    
    // Initialize data from config
    this.initializeContacts();
    this.initializeDeals();
    this.initializeAccounts();
    this.initializeLeads();
    this.initializeCases();
    this.initializeActivities();
  }
  
  /**
   * Инициализирует контакты из конфига
   */
  private initializeContacts(): void {
    this.contacts.clear();
    if (this.config?.contacts) {
      for (const contact of this.config.contacts) {
        this.contacts.set(contact.id, {
          ...contact,
          createdAt: contact.createdAt || Date.now(),
          lastContact: contact.lastContact || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует сделки из конфига
   */
  private initializeDeals(): void {
    this.deals.clear();
    if (this.config?.deals) {
      for (const deal of this.config.deals) {
        this.deals.set(deal.id, {
          ...deal,
          createdAt: deal.createdAt || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует аккаунты из конфига
   */
  private initializeAccounts(): void {
    this.accounts.clear();
    if (this.config?.accounts) {
      for (const account of this.config.accounts) {
        this.accounts.set(account.id, {
          ...account,
          createdAt: account.createdAt || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует лиды из конфига
   */
  private initializeLeads(): void {
    this.leads.clear();
    if (this.config?.leads) {
      for (const lead of this.config.leads) {
        this.leads.set(lead.id, {
          ...lead,
          createdAt: lead.createdAt || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует кейсы из конфига
   */
  private initializeCases(): void {
    this.cases.clear();
    if (this.config?.cases) {
      for (const crmCase of this.config.cases) {
        this.cases.set(crmCase.id, {
          ...crmCase,
          createdAt: crmCase.createdAt || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует активности из конфига
   */
  private initializeActivities(): void {
    this.activities.clear();
    if (this.config?.activities) {
      for (const activity of this.config.activities) {
        this.activities.set(activity.id, activity);
      }
    }
  }
  
  /**
   * Выполняет один цикл обновления CRM
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config) return;
    
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Simulate API requests if there are incoming connections
    if (hasIncomingConnections) {
      this.simulateAPIRequests(currentTime);
    }
    
    // Simulate lead conversion
    this.simulateLeadConversion(currentTime);
    
    // Simulate deal progression
    this.simulateDealProgression(currentTime);
    
    // Simulate case resolution
    this.simulateCaseResolution(currentTime);
    
    // Generate activities
    if (currentTime - this.lastActivityGeneration > this.ACTIVITY_GENERATION_INTERVAL) {
      this.generateActivities(currentTime);
      this.lastActivityGeneration = currentTime;
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Симулирует API запросы к CRM
   */
  private simulateAPIRequests(currentTime: number): void {
    if (!this.config) return;
    
    const requestsPerSecond = this.config.requestsPerSecond || 10;
    const requestsPerUpdate = (requestsPerSecond * 0.1); // 100ms update interval
    
    for (let i = 0; i < requestsPerUpdate; i++) {
      if (Math.random() < 0.1) { // 10% chance per update cycle
        const latency = this.config.averageResponseTime || 150;
        const error = Math.random() < (this.config.errorRate || 0.02);
        const actualLatency = latency + (Math.random() - 0.5) * latency * 0.5; // ±50% variation
        
        this.requestHistory.push({
          timestamp: currentTime,
          latency: actualLatency,
          success: !error,
        });
        
        // Keep history size limited
        if (this.requestHistory.length > this.MAX_REQUEST_HISTORY) {
          this.requestHistory.shift();
        }
      }
    }
  }
  
  /**
   * Симулирует конвертацию лидов в контакты
   */
  private simulateLeadConversion(currentTime: number): void {
    if (!this.config?.enableLeads || !this.config?.enableContacts) return;
    
    const conversionRate = this.config.conversionRate || 0.15;
    
    for (const lead of this.leads.values()) {
      if (lead.status === 'qualified' && Math.random() < conversionRate * 0.001) { // Small chance per update
        // Convert lead to contact
        const contact: CRMContact = {
          id: `contact-${lead.id}`,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          status: 'lead',
          createdAt: currentTime,
          lastContact: currentTime,
        };
        
        this.contacts.set(contact.id, contact);
        
        // Update lead
        lead.status = 'converted';
        lead.convertedToContactId = contact.id;
      }
    }
  }
  
  /**
   * Симулирует прогрессию сделок по стадиям
   */
  private simulateDealProgression(currentTime: number): void {
    if (!this.config?.enableOpportunities) return;
    
    const winRate = this.config.dealWinRate || 0.25;
    
    for (const deal of this.deals.values()) {
      if (deal.stage === 'closed-won' || deal.stage === 'closed-lost') continue;
      
      // Small chance to progress deal
      if (Math.random() < 0.001) { // 0.1% chance per update
        const stages: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
        const currentIndex = stages.indexOf(deal.stage);
        
        if (currentIndex < stages.length - 2) {
          if (currentIndex === stages.length - 3) { // negotiation -> closed
            deal.stage = Math.random() < winRate ? 'closed-won' : 'closed-lost';
            deal.actualClose = currentTime;
          } else {
            deal.stage = stages[currentIndex + 1];
          }
        }
      }
    }
  }
  
  /**
   * Симулирует разрешение кейсов
   */
  private simulateCaseResolution(currentTime: number): void {
    if (!this.config?.enableCases) return;
    
    const averageResolutionTime = (this.config.caseResolutionTime || 24) * 3600000; // hours to ms
    
    for (const crmCase of this.cases.values()) {
      if (crmCase.status === 'resolved' || crmCase.status === 'closed') continue;
      
      const caseAge = currentTime - (crmCase.createdAt || currentTime);
      const resolutionProbability = Math.min(1, caseAge / averageResolutionTime);
      
      if (Math.random() < resolutionProbability * 0.01) { // Small chance per update
        crmCase.status = 'resolved';
        crmCase.resolvedAt = currentTime;
      }
    }
  }
  
  /**
   * Генерирует активности (звонки, встречи, задачи)
   */
  private generateActivities(currentTime: number): void {
    if (!this.config) return;
    
    const activityTypes: Array<'call' | 'email' | 'meeting' | 'task' | 'note'> = ['call', 'email', 'meeting', 'task', 'note'];
    const numActivities = Math.floor(Math.random() * 3); // 0-2 activities
    
    for (let i = 0; i < numActivities; i++) {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const relatedTo = this.getRandomRelatedEntity();
      
      const activity: CRMActivity = {
        id: `activity-${currentTime}-${i}`,
        type,
        subject: `${type.charAt(0).toUpperCase() + type.slice(1)} with ${relatedTo.name}`,
        relatedTo: relatedTo.id,
        relatedType: relatedTo.type,
        timestamp: currentTime,
        duration: type === 'call' || type === 'meeting' ? Math.floor(Math.random() * 60) + 15 : undefined,
        status: Math.random() < 0.7 ? 'completed' : 'scheduled',
      };
      
      this.activities.set(activity.id, activity);
    }
  }
  
  /**
   * Получает случайную связанную сущность для активности
   */
  private getRandomRelatedEntity(): { id: string; name: string; type: 'contact' | 'deal' | 'account' | 'case' } {
    const allEntities: Array<{ id: string; name: string; type: 'contact' | 'deal' | 'account' | 'case' }> = [];
    
    for (const contact of this.contacts.values()) {
      allEntities.push({ id: contact.id, name: contact.name, type: 'contact' });
    }
    for (const deal of this.deals.values()) {
      allEntities.push({ id: deal.id, name: deal.name, type: 'deal' });
    }
    for (const account of this.accounts.values()) {
      allEntities.push({ id: account.id, name: account.name, type: 'account' });
    }
    for (const crmCase of this.cases.values()) {
      allEntities.push({ id: crmCase.id, name: crmCase.subject, type: 'case' });
    }
    
    if (allEntities.length === 0) {
      return { id: 'default', name: 'Unknown', type: 'contact' };
    }
    
    return allEntities[Math.floor(Math.random() * allEntities.length)];
  }
  
  /**
   * Обновляет метрики на основе текущего состояния
   */
  private updateMetrics(): void {
    // Contacts metrics
    this.crmMetrics.contactsTotal = this.contacts.size;
    this.crmMetrics.contactsLeads = Array.from(this.contacts.values()).filter(c => c.status === 'lead').length;
    this.crmMetrics.contactsCustomers = Array.from(this.contacts.values()).filter(c => c.status === 'customer').length;
    this.crmMetrics.contactsPartners = Array.from(this.contacts.values()).filter(c => c.status === 'partner').length;
    
    // Deals metrics
    this.crmMetrics.dealsTotal = this.deals.size;
    this.crmMetrics.dealsActive = Array.from(this.deals.values()).filter(d => 
      d.stage !== 'closed-won' && d.stage !== 'closed-lost'
    ).length;
    this.crmMetrics.dealsWon = Array.from(this.deals.values()).filter(d => d.stage === 'closed-won').length;
    this.crmMetrics.dealsLost = Array.from(this.deals.values()).filter(d => d.stage === 'closed-lost').length;
    this.crmMetrics.pipelineValue = Array.from(this.deals.values())
      .filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost')
      .reduce((sum, d) => sum + d.value, 0);
    this.crmMetrics.wonValue = Array.from(this.deals.values())
      .filter(d => d.stage === 'closed-won')
      .reduce((sum, d) => sum + d.value, 0);
    
    // Accounts metrics
    this.crmMetrics.accountsTotal = this.accounts.size;
    this.crmMetrics.accountsCustomers = Array.from(this.accounts.values()).filter(a => a.type === 'customer').length;
    this.crmMetrics.accountsPartners = Array.from(this.accounts.values()).filter(a => a.type === 'partner').length;
    
    // Leads metrics
    this.crmMetrics.leadsTotal = this.leads.size;
    this.crmMetrics.leadsNew = Array.from(this.leads.values()).filter(l => l.status === 'new').length;
    this.crmMetrics.leadsQualified = Array.from(this.leads.values()).filter(l => l.status === 'qualified').length;
    this.crmMetrics.leadsConverted = Array.from(this.leads.values()).filter(l => l.status === 'converted').length;
    
    // Cases metrics
    this.crmMetrics.casesTotal = this.cases.size;
    this.crmMetrics.casesOpen = Array.from(this.cases.values()).filter(c => 
      c.status !== 'resolved' && c.status !== 'closed'
    ).length;
    this.crmMetrics.casesResolved = Array.from(this.cases.values()).filter(c => c.status === 'resolved').length;
    
    // Calculate average resolution time
    const resolvedCases = Array.from(this.cases.values()).filter(c => c.resolvedAt && c.createdAt);
    if (resolvedCases.length > 0) {
      const totalResolutionTime = resolvedCases.reduce((sum, c) => {
        return sum + ((c.resolvedAt || 0) - (c.createdAt || 0));
      }, 0);
      this.crmMetrics.averageResolutionTime = (totalResolutionTime / resolvedCases.length) / 3600000; // ms to hours
    }
    
    // Activities metrics
    this.crmMetrics.activitiesTotal = this.activities.size;
    const today = Date.now();
    const todayStart = new Date(today).setHours(0, 0, 0, 0);
    this.crmMetrics.activitiesToday = Array.from(this.activities.values()).filter(a => 
      a.timestamp >= todayStart
    ).length;
    
    // Performance metrics from request history
    if (this.requestHistory.length > 0) {
      const recentRequests = this.requestHistory.slice(-100); // Last 100 requests
      const timeWindow = 10000; // 10 seconds
      const recentTime = Date.now() - timeWindow;
      const requestsInWindow = recentRequests.filter(r => r.timestamp >= recentTime);
      
      this.crmMetrics.requestsPerSecond = requestsInWindow.length / (timeWindow / 1000);
      this.crmMetrics.averageResponseTime = recentRequests.reduce((sum, r) => sum + r.latency, 0) / recentRequests.length;
      this.crmMetrics.errorRate = recentRequests.filter(r => !r.success).length / recentRequests.length;
    }
    
    // Conversion and win rates
    if (this.leads.size > 0) {
      this.crmMetrics.conversionRate = this.crmMetrics.leadsConverted / this.leads.size;
    }
    if (this.deals.size > 0) {
      this.crmMetrics.dealWinRate = this.crmMetrics.dealsWon / (this.crmMetrics.dealsWon + this.crmMetrics.dealsLost || 1);
    }
    
    // Utilization (based on request rate vs capacity)
    const maxRequestsPerSecond = this.config?.requestsPerSecond || 10;
    this.crmMetrics.apiUtilization = Math.min(1, this.crmMetrics.requestsPerSecond / maxRequestsPerSecond);
    this.crmMetrics.databaseUtilization = Math.min(1, (this.contacts.size + this.deals.size + this.accounts.size) / 10000); // Assume 10k capacity
  }
  
  /**
   * Возвращает текущие метрики
   */
  getMetrics(): CRMEngineMetrics {
    return { ...this.crmMetrics };
  }
  
  /**
   * Возвращает все контакты
   */
  getContacts(): CRMContact[] {
    return Array.from(this.contacts.values());
  }
  
  /**
   * Возвращает все сделки
   */
  getDeals(): CRMDeal[] {
    return Array.from(this.deals.values());
  }
  
  /**
   * Возвращает все аккаунты
   */
  getAccounts(): CRMAccount[] {
    return Array.from(this.accounts.values());
  }
  
  /**
   * Возвращает все лиды
   */
  getLeads(): CRMLead[] {
    return Array.from(this.leads.values());
  }
  
  /**
   * Возвращает все кейсы
   */
  getCases(): CRMCase[] {
    return Array.from(this.cases.values());
  }
  
  /**
   * Возвращает все активности
   */
  getActivities(): CRMActivity[] {
    return Array.from(this.activities.values());
  }
  
  /**
   * Добавляет контакт
   */
  addContact(contact: CRMContact): void {
    this.contacts.set(contact.id, contact);
    this.updateMetrics();
  }
  
  /**
   * Обновляет контакт
   */
  updateContact(id: string, updates: Partial<CRMContact>): void {
    const contact = this.contacts.get(id);
    if (contact) {
      this.contacts.set(id, { ...contact, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет контакт
   */
  removeContact(id: string): void {
    this.contacts.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Добавляет сделку
   */
  addDeal(deal: CRMDeal): void {
    this.deals.set(deal.id, deal);
    this.updateMetrics();
  }
  
  /**
   * Обновляет сделку
   */
  updateDeal(id: string, updates: Partial<CRMDeal>): void {
    const deal = this.deals.get(id);
    if (deal) {
      this.deals.set(id, { ...deal, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет сделку
   */
  removeDeal(id: string): void {
    this.deals.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Добавляет аккаунт
   */
  addAccount(account: CRMAccount): void {
    this.accounts.set(account.id, account);
    this.updateMetrics();
  }
  
  /**
   * Обновляет аккаунт
   */
  updateAccount(id: string, updates: Partial<CRMAccount>): void {
    const account = this.accounts.get(id);
    if (account) {
      this.accounts.set(id, { ...account, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет аккаунт
   */
  removeAccount(id: string): void {
    this.accounts.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Добавляет лид
   */
  addLead(lead: CRMLead): void {
    this.leads.set(lead.id, lead);
    this.updateMetrics();
  }
  
  /**
   * Обновляет лид
   */
  updateLead(id: string, updates: Partial<CRMLead>): void {
    const lead = this.leads.get(id);
    if (lead) {
      this.leads.set(id, { ...lead, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет лид
   */
  removeLead(id: string): void {
    this.leads.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Добавляет кейс
   */
  addCase(crmCase: CRMCase): void {
    this.cases.set(crmCase.id, crmCase);
    this.updateMetrics();
  }
  
  /**
   * Обновляет кейс
   */
  updateCase(id: string, updates: Partial<CRMCase>): void {
    const crmCase = this.cases.get(id);
    if (crmCase) {
      this.cases.set(id, { ...crmCase, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет кейс
   */
  removeCase(id: string): void {
    this.cases.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Синхронизирует данные с конфигом компонента
   */
  syncToConfig(): CRMEmulationConfig {
    return {
      ...this.config,
      contacts: this.getContacts(),
      deals: this.getDeals(),
      accounts: this.getAccounts(),
      leads: this.getLeads(),
      cases: this.getCases(),
      activities: this.getActivities(),
    };
  }
}
