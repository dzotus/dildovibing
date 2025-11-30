import { ComponentProfile } from '@/components/config/shared/types';

export const BUSINESS_PROFILES: Record<string, ComponentProfile> = {
  crm: {
    id: 'crm',
    title: 'CRM System',
    description: 'Configure CRM contacts, deals, sales pipelines, and automation workflows',
    defaults: {
      serverUrl: 'http://localhost:3000',
      enableContacts: true,
      enableDeals: true,
      enableLeads: true,
      enableAccounts: true,
      salesPipeline: 'default',
      enableEmailIntegration: false,
      enableCalendarSync: false,
      enableReporting: true,
      customFields: [],
      automationRules: [],
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:3000' },
        ],
      },
      {
        id: 'modules',
        title: 'CRM Modules',
        fields: [
          { id: 'enableContacts', label: 'Enable Contacts Module', type: 'toggle' },
          { id: 'enableDeals', label: 'Enable Deals Module', type: 'toggle' },
          { id: 'enableLeads', label: 'Enable Leads Module', type: 'toggle' },
          { id: 'enableAccounts', label: 'Enable Accounts Module', type: 'toggle' },
        ],
      },
      {
        id: 'sales',
        title: 'Sales Pipeline',
        fields: [
          { id: 'salesPipeline', label: 'Default Sales Pipeline', type: 'text', placeholder: 'default' },
        ],
      },
      {
        id: 'integrations',
        title: 'Integrations',
        fields: [
          { id: 'enableEmailIntegration', label: 'Enable Email Integration', type: 'toggle' },
          { id: 'enableCalendarSync', label: 'Enable Calendar Sync', type: 'toggle' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enableReporting', label: 'Enable Reporting', type: 'toggle' },
        ],
      },
    ],
  },
  erp: {
    id: 'erp',
    title: 'ERP / SAP System',
    description: 'Configure ERP modules, business processes, financials, and supply chain',
    defaults: {
      serverUrl: 'http://localhost:8000',
      erpType: 'sap',
      enableFinancials: true,
      enableHR: true,
      enableSCM: true,
      enableManufacturing: false,
      enableCRM: false,
      fiscalYear: '2024',
      currency: 'USD',
      enableMultiCurrency: false,
      businessProcesses: [],
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:8000' },
          {
            id: 'erpType',
            label: 'ERP Type',
            type: 'select',
            options: [
              { value: 'sap', label: 'SAP' },
              { value: 'oracle', label: 'Oracle ERP' },
              { value: 'microsoft', label: 'Microsoft Dynamics' },
              { value: 'netsuite', label: 'NetSuite' },
            ],
          },
        ],
      },
      {
        id: 'modules',
        title: 'ERP Modules',
        fields: [
          { id: 'enableFinancials', label: 'Financials Module', type: 'toggle' },
          { id: 'enableHR', label: 'Human Resources Module', type: 'toggle' },
          { id: 'enableSCM', label: 'Supply Chain Management', type: 'toggle' },
          { id: 'enableManufacturing', label: 'Manufacturing Module', type: 'toggle' },
          { id: 'enableCRM', label: 'CRM Module', type: 'toggle' },
        ],
      },
      {
        id: 'financials',
        title: 'Financial Settings',
        fields: [
          { id: 'fiscalYear', label: 'Fiscal Year', type: 'text', placeholder: '2024' },
          { id: 'currency', label: 'Base Currency', type: 'text', placeholder: 'USD' },
          { id: 'enableMultiCurrency', label: 'Enable Multi-Currency', type: 'toggle' },
        ],
      },
    ],
  },
  'payment-gateway': {
    id: 'payment-gateway',
    title: 'Payment Gateway',
    description: 'Configure payment methods, transaction processing, webhooks, and security',
    defaults: {
      gatewayProvider: 'stripe',
      apiKey: '',
      secretKey: '',
      enableCreditCards: true,
      enableDebitCards: true,
      enableDigitalWallets: false,
      enableCryptocurrency: false,
      supportedCurrencies: ['USD', 'EUR'],
      enable3DSecure: true,
      enableFraudDetection: true,
      webhookUrl: '',
      enableRefunds: true,
      enableRecurringPayments: false,
    },
    sections: [
      {
        id: 'provider',
        title: 'Gateway Provider',
        fields: [
          {
            id: 'gatewayProvider',
            label: 'Payment Gateway',
            type: 'select',
            options: [
              { value: 'stripe', label: 'Stripe' },
              { value: 'paypal', label: 'PayPal' },
              { value: 'square', label: 'Square' },
              { value: 'adyen', label: 'Adyen' },
              { value: 'braintree', label: 'Braintree' },
            ],
          },
          { id: 'apiKey', label: 'API Key', type: 'password', placeholder: '••••••••' },
          { id: 'secretKey', label: 'Secret Key', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        fields: [
          { id: 'enableCreditCards', label: 'Credit Cards', type: 'toggle' },
          { id: 'enableDebitCards', label: 'Debit Cards', type: 'toggle' },
          { id: 'enableDigitalWallets', label: 'Digital Wallets (Apple Pay, Google Pay)', type: 'toggle' },
          { id: 'enableCryptocurrency', label: 'Cryptocurrency', type: 'toggle' },
        ],
      },
      {
        id: 'currencies',
        title: 'Currencies',
        fields: [
          {
            id: 'supportedCurrencies',
            label: 'Supported Currencies',
            type: 'list',
            placeholder: 'USD',
            defaultListItem: 'USD',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enable3DSecure', label: 'Enable 3D Secure', type: 'toggle' },
          { id: 'enableFraudDetection', label: 'Enable Fraud Detection', type: 'toggle' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enableRefunds', label: 'Enable Refunds', type: 'toggle' },
          { id: 'enableRecurringPayments', label: 'Enable Recurring Payments', type: 'toggle' },
          { id: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://example.com/webhook' },
        ],
      },
    ],
  },
  'bpmn-engine': {
    id: 'bpmn-engine',
    title: 'BPMN Process Engine',
    description: 'Configure business processes, workflows, tasks, and automation rules',
    defaults: {
      engineUrl: 'http://localhost:8080',
      enableProcessExecution: true,
      enableTaskManagement: true,
      enableFormEngine: true,
      enableDecisionEngine: false,
      defaultProcessTimeout: 3600,
      enableProcessHistory: true,
      enableProcessMonitoring: true,
      processDefinitions: [],
      businessRules: [],
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'engineUrl', label: 'Engine URL', type: 'text', placeholder: 'http://localhost:8080' },
        ],
      },
      {
        id: 'features',
        title: 'Engine Features',
        fields: [
          { id: 'enableProcessExecution', label: 'Process Execution', type: 'toggle' },
          { id: 'enableTaskManagement', label: 'Task Management', type: 'toggle' },
          { id: 'enableFormEngine', label: 'Form Engine', type: 'toggle' },
          { id: 'enableDecisionEngine', label: 'Decision Engine (DMN)', type: 'toggle' },
        ],
      },
      {
        id: 'processes',
        title: 'Process Settings',
        fields: [
          { id: 'defaultProcessTimeout', label: 'Default Process Timeout (seconds)', type: 'number', placeholder: '3600' },
          { id: 'enableProcessHistory', label: 'Enable Process History', type: 'toggle' },
          { id: 'enableProcessMonitoring', label: 'Enable Process Monitoring', type: 'toggle' },
        ],
      },
      {
        id: 'bpmn',
        title: 'BPMN Process Definition',
        fields: [
          {
            id: 'processDefinitions',
            label: 'Process Definition IDs',
            type: 'list',
            placeholder: 'order-processing',
            defaultListItem: 'order-processing',
          },
        ],
      },
    ],
  },
  'rpa-bot': {
    id: 'rpa-bot',
    title: 'RPA Bot',
    description: 'Configure robotic process automation, workflows, and task scheduling',
    defaults: {
      botName: 'rpa-bot-1',
      enableScheduling: true,
      enableErrorHandling: true,
      maxRetries: 3,
      enableLogging: true,
      enableScreenshots: false,
      automationScripts: [],
      scheduledTasks: [],
    },
    sections: [
      {
        id: 'bot',
        title: 'Bot Configuration',
        fields: [
          { id: 'botName', label: 'Bot Name', type: 'text', placeholder: 'rpa-bot-1' },
        ],
      },
      {
        id: 'automation',
        title: 'Automation',
        fields: [
          {
            id: 'automationScripts',
            label: 'Automation Scripts',
            type: 'list',
            placeholder: 'data-entry.robot',
            defaultListItem: 'data-entry.robot',
          },
        ],
      },
      {
        id: 'scheduling',
        title: 'Scheduling',
        fields: [
          { id: 'enableScheduling', label: 'Enable Task Scheduling', type: 'toggle' },
          {
            id: 'scheduledTasks',
            label: 'Scheduled Tasks',
            type: 'list',
            placeholder: 'daily-report',
            defaultListItem: 'daily-report',
          },
        ],
      },
      {
        id: 'error-handling',
        title: 'Error Handling',
        fields: [
          { id: 'enableErrorHandling', label: 'Enable Error Handling', type: 'toggle' },
          { id: 'maxRetries', label: 'Max Retries', type: 'number', placeholder: '3' },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          { id: 'enableLogging', label: 'Enable Logging', type: 'toggle' },
          { id: 'enableScreenshots', label: 'Enable Screenshots on Error', type: 'toggle' },
        ],
      },
    ],
  },
};

