import { ComponentProfile } from '../shared/types';

export const BUSINESS_PROFILES: Record<string, ComponentProfile> = {
  crm: {
    id: 'crm',
    title: 'CRM System',
    description: 'Customer Relationship Management system for managing customer interactions.',
    badge: 'CRM',
    defaults: {
      crmType: 'salesforce',
      enableContacts: true,
      enableLeads: true,
      enableOpportunities: true,
      enableAccounts: true,
      enableCases: true,
      enableReports: true,
      enableWorkflows: true,
      enableIntegrations: true,
      apiEndpoint: 'https://api.crm.example.com',
    },
    sections: [
      {
        id: 'crm',
        title: 'CRM Configuration',
        fields: [
          {
            id: 'crmType',
            label: 'CRM Type',
            type: 'select',
            options: [
              { label: 'Salesforce', value: 'salesforce' },
              { label: 'HubSpot', value: 'hubspot' },
              { label: 'Microsoft Dynamics', value: 'dynamics' },
              { label: 'Custom', value: 'custom' },
            ],
          },
          {
            id: 'apiEndpoint',
            label: 'API Endpoint',
            type: 'text',
            placeholder: 'https://api.crm.example.com',
          },
        ],
      },
      {
        id: 'modules',
        title: 'Modules',
        fields: [
          {
            id: 'enableContacts',
            label: 'Enable Contacts',
            type: 'toggle',
          },
          {
            id: 'enableLeads',
            label: 'Enable Leads',
            type: 'toggle',
          },
          {
            id: 'enableOpportunities',
            label: 'Enable Opportunities',
            type: 'toggle',
          },
          {
            id: 'enableAccounts',
            label: 'Enable Accounts',
            type: 'toggle',
          },
          {
            id: 'enableCases',
            label: 'Enable Cases',
            type: 'toggle',
            description: 'Support ticket management',
          },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          {
            id: 'enableReports',
            label: 'Enable Reports',
            type: 'toggle',
          },
          {
            id: 'enableWorkflows',
            label: 'Enable Workflows',
            type: 'toggle',
            description: 'Automated business processes',
          },
          {
            id: 'enableIntegrations',
            label: 'Enable Integrations',
            type: 'toggle',
            description: 'Third-party integrations',
          },
        ],
      },
    ],
  },
  erp: {
    id: 'erp',
    title: 'ERP / SAP',
    description: 'Enterprise Resource Planning system for managing business processes.',
    badge: 'ERP',
    defaults: {
      erpType: 'sap',
      enableFinance: true,
      enableHR: true,
      enableSupplyChain: true,
      enableManufacturing: true,
      enableSales: true,
      enableInventory: true,
      enableReporting: true,
      apiEndpoint: 'https://sap.example.com',
    },
    sections: [
      {
        id: 'erp',
        title: 'ERP Configuration',
        fields: [
          {
            id: 'erpType',
            label: 'ERP Type',
            type: 'select',
            options: [
              { label: 'SAP', value: 'sap' },
              { label: 'Oracle ERP', value: 'oracle' },
              { label: 'Microsoft Dynamics', value: 'dynamics' },
              { label: 'NetSuite', value: 'netsuite' },
            ],
          },
          {
            id: 'apiEndpoint',
            label: 'API Endpoint',
            type: 'text',
            placeholder: 'https://erp.example.com',
          },
        ],
      },
      {
        id: 'modules',
        title: 'Modules',
        fields: [
          {
            id: 'enableFinance',
            label: 'Enable Finance',
            type: 'toggle',
            description: 'Financial management',
          },
          {
            id: 'enableHR',
            label: 'Enable HR',
            type: 'toggle',
            description: 'Human resources',
          },
          {
            id: 'enableSupplyChain',
            label: 'Enable Supply Chain',
            type: 'toggle',
          },
          {
            id: 'enableManufacturing',
            label: 'Enable Manufacturing',
            type: 'toggle',
          },
          {
            id: 'enableSales',
            label: 'Enable Sales',
            type: 'toggle',
          },
          {
            id: 'enableInventory',
            label: 'Enable Inventory',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'reporting',
        title: 'Reporting',
        fields: [
          {
            id: 'enableReporting',
            label: 'Enable Reporting',
            type: 'toggle',
            description: 'Business intelligence and reporting',
          },
        ],
      },
    ],
  },
  'payment-gateway': {
    id: 'payment-gateway',
    title: 'Payment Gateway',
    description: 'Payment processing gateway for handling transactions.',
    badge: 'Payments',
    defaults: {
      gatewayType: 'stripe',
      enableCreditCards: true,
      enableDebitCards: true,
      enableACH: false,
      enableCryptocurrency: false,
      enable3DSecure: true,
      enableFraudDetection: true,
      enableRefunds: true,
      enableRecurringPayments: true,
      apiKey: '',
      webhookUrl: 'https://api.example.com/webhooks/payment',
    },
    sections: [
      {
        id: 'gateway',
        title: 'Gateway Configuration',
        fields: [
          {
            id: 'gatewayType',
            label: 'Gateway Type',
            type: 'select',
            options: [
              { label: 'Stripe', value: 'stripe' },
              { label: 'PayPal', value: 'paypal' },
              { label: 'Square', value: 'square' },
              { label: 'Adyen', value: 'adyen' },
            ],
          },
          {
            id: 'apiKey',
            label: 'API Key',
            type: 'text',
            placeholder: 'sk_live_...',
          },
          {
            id: 'webhookUrl',
            label: 'Webhook URL',
            type: 'text',
            placeholder: 'https://api.example.com/webhooks/payment',
          },
        ],
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        fields: [
          {
            id: 'enableCreditCards',
            label: 'Enable Credit Cards',
            type: 'toggle',
          },
          {
            id: 'enableDebitCards',
            label: 'Enable Debit Cards',
            type: 'toggle',
          },
          {
            id: 'enableACH',
            label: 'Enable ACH',
            type: 'toggle',
            description: 'Bank transfers',
          },
          {
            id: 'enableCryptocurrency',
            label: 'Enable Cryptocurrency',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enable3DSecure',
            label: 'Enable 3D Secure',
            type: 'toggle',
            description: 'Additional authentication for cards',
          },
          {
            id: 'enableFraudDetection',
            label: 'Enable Fraud Detection',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          {
            id: 'enableRefunds',
            label: 'Enable Refunds',
            type: 'toggle',
          },
          {
            id: 'enableRecurringPayments',
            label: 'Enable Recurring Payments',
            type: 'toggle',
            description: 'Subscription payments',
          },
        ],
      },
    ],
  },
  'bpmn-engine': {
    id: 'bpmn-engine',
    title: 'BPMN Engine',
    description: 'Business Process Model and Notation engine for workflow automation.',
    badge: 'Workflow',
    defaults: {
      engineType: 'camunda',
      enableProcessExecution: true,
      enableTaskManagement: true,
      enableHistory: true,
      enableMetrics: true,
      enableCockpit: true,
      cockpitPort: 8080,
      enableOptimize: false,
      enableIdentity: true,
      enableExternalTasks: true,
    },
    sections: [
      {
        id: 'engine',
        title: 'Engine Configuration',
        fields: [
          {
            id: 'engineType',
            label: 'Engine Type',
            type: 'select',
            options: [
              { label: 'Camunda', value: 'camunda' },
              { label: 'Activiti', value: 'activiti' },
              { label: 'Flowable', value: 'flowable' },
            ],
          },
        ],
      },
      {
        id: 'execution',
        title: 'Process Execution',
        fields: [
          {
            id: 'enableProcessExecution',
            label: 'Enable Process Execution',
            type: 'toggle',
          },
          {
            id: 'enableTaskManagement',
            label: 'Enable Task Management',
            type: 'toggle',
            description: 'Human tasks and user tasks',
          },
          {
            id: 'enableHistory',
            label: 'Enable History',
            type: 'toggle',
            description: 'Process execution history',
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'enableCockpit',
            label: 'Enable Cockpit',
            type: 'toggle',
            description: 'Web UI for process monitoring',
          },
          {
            id: 'cockpitPort',
            label: 'Cockpit Port',
            type: 'number',
            min: 1024,
            max: 65535,
          },
          {
            id: 'enableOptimize',
            label: 'Enable Optimize',
            type: 'toggle',
            description: 'Process optimization and analytics',
          },
        ],
      },
      {
        id: 'integration',
        title: 'Integration',
        fields: [
          {
            id: 'enableIdentity',
            label: 'Enable Identity',
            type: 'toggle',
            description: 'User and group management',
          },
          {
            id: 'enableExternalTasks',
            label: 'Enable External Tasks',
            type: 'toggle',
            description: 'External task workers',
          },
        ],
      },
    ],
  },
  'rpa-bot': {
    id: 'rpa-bot',
    title: 'RPA Bot',
    description: 'Robotic Process Automation bot for automating repetitive tasks.',
    badge: 'Automation',
    defaults: {
      botType: 'uipath',
      enableScheduling: true,
      enableMonitoring: true,
      enableLogging: true,
      enableErrorHandling: true,
      enableRetry: true,
      retryAttempts: 3,
      enableNotifications: true,
      notificationChannels: ['email'],
    },
    sections: [
      {
        id: 'bot',
        title: 'Bot Configuration',
        fields: [
          {
            id: 'botType',
            label: 'Bot Type',
            type: 'select',
            options: [
              { label: 'UiPath', value: 'uipath' },
              { label: 'Automation Anywhere', value: 'automation-anywhere' },
              { label: 'Blue Prism', value: 'blue-prism' },
            ],
          },
        ],
      },
      {
        id: 'scheduling',
        title: 'Scheduling',
        fields: [
          {
            id: 'enableScheduling',
            label: 'Enable Scheduling',
            type: 'toggle',
            description: 'Schedule bot execution',
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring & Logging',
        fields: [
          {
            id: 'enableMonitoring',
            label: 'Enable Monitoring',
            type: 'toggle',
          },
          {
            id: 'enableLogging',
            label: 'Enable Logging',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'reliability',
        title: 'Reliability',
        fields: [
          {
            id: 'enableErrorHandling',
            label: 'Enable Error Handling',
            type: 'toggle',
          },
          {
            id: 'enableRetry',
            label: 'Enable Retry',
            type: 'toggle',
          },
          {
            id: 'retryAttempts',
            label: 'Retry Attempts',
            type: 'number',
            min: 1,
            max: 10,
          },
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications',
        fields: [
          {
            id: 'enableNotifications',
            label: 'Enable Notifications',
            type: 'toggle',
          },
          {
            id: 'notificationChannels',
            label: 'Notification Channels',
            type: 'list',
            description: 'Channels for bot notifications',
            defaultListItem: 'email',
          },
        ],
      },
    ],
  },
};

