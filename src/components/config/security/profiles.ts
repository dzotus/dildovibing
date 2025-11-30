import { ComponentProfile } from '@/components/config/shared/types';

export const SECURITY_PROFILES: Record<string, ComponentProfile> = {
  keycloak: {
    id: 'keycloak',
    title: 'Keycloak Identity Provider',
    description: 'Configure Keycloak realm, clients, authentication flows, and user federation',
    defaults: {
      serverUrl: 'http://localhost:8080',
      realm: 'master',
      adminUsername: 'admin',
      adminPassword: '',
      enableRegistration: false,
      enableRememberMe: true,
      sessionTimeout: 1800,
      sslRequired: 'external',
      passwordPolicy: '',
      enableBruteForceDetection: true,
      maxFailureWait: 900,
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'http://localhost:8080' },
          { id: 'realm', label: 'Realm Name', type: 'text', placeholder: 'master' },
          { id: 'adminUsername', label: 'Admin Username', type: 'text', placeholder: 'admin' },
          { id: 'adminPassword', label: 'Admin Password', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'authentication',
        title: 'Authentication',
        fields: [
          { id: 'enableRegistration', label: 'Enable User Registration', type: 'toggle' },
          { id: 'enableRememberMe', label: 'Enable Remember Me', type: 'toggle' },
          { id: 'sessionTimeout', label: 'Session Timeout (seconds)', type: 'number', placeholder: '1800' },
          {
            id: 'sslRequired',
            label: 'SSL Required',
            type: 'select',
            options: [
              { value: 'none', label: 'None' },
              { value: 'external', label: 'External Only' },
              { value: 'all', label: 'All Requests' },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security Policies',
        fields: [
          { id: 'passwordPolicy', label: 'Password Policy', type: 'text', placeholder: 'length(8) and digits(1)' },
          { id: 'enableBruteForceDetection', label: 'Enable Brute Force Detection', type: 'toggle' },
          { id: 'maxFailureWait', label: 'Max Failure Wait (seconds)', type: 'number', placeholder: '900' },
        ],
      },
    ],
  },
  waf: {
    id: 'waf',
    title: 'Web Application Firewall',
    description: 'Configure WAF rules, rate limiting, and threat protection policies',
    defaults: {
      mode: 'detection',
      enableRateLimiting: true,
      rateLimitPerMinute: 100,
      enableDDoSProtection: true,
      enableSQLInjectionProtection: true,
      enableXSSProtection: true,
      enableCSRFProtection: true,
      blockSuspiciousIPs: true,
      whitelistIPs: [],
      blacklistIPs: [],
    },
    sections: [
      {
        id: 'mode',
        title: 'Operation Mode',
        fields: [
          {
            id: 'mode',
            label: 'WAF Mode',
            type: 'select',
            options: [
              { value: 'disabled', label: 'Disabled' },
              { value: 'detection', label: 'Detection Only' },
              { value: 'prevention', label: 'Prevention' },
            ],
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting',
        fields: [
          { id: 'enableRateLimiting', label: 'Enable Rate Limiting', type: 'toggle' },
          { id: 'rateLimitPerMinute', label: 'Requests Per Minute', type: 'number', placeholder: '100' },
        ],
      },
      {
        id: 'threat-protection',
        title: 'Threat Protection',
        fields: [
          { id: 'enableDDoSProtection', label: 'DDoS Protection', type: 'toggle' },
          { id: 'enableSQLInjectionProtection', label: 'SQL Injection Protection', type: 'toggle' },
          { id: 'enableXSSProtection', label: 'XSS Protection', type: 'toggle' },
          { id: 'enableCSRFProtection', label: 'CSRF Protection', type: 'toggle' },
        ],
      },
      {
        id: 'ip-filtering',
        title: 'IP Filtering',
        fields: [
          { id: 'blockSuspiciousIPs', label: 'Auto-Block Suspicious IPs', type: 'toggle' },
          {
            id: 'whitelistIPs',
            label: 'Whitelist IPs',
            type: 'list',
            placeholder: '192.168.1.1',
            defaultListItem: '192.168.1.1',
          },
          {
            id: 'blacklistIPs',
            label: 'Blacklist IPs',
            type: 'list',
            placeholder: '10.0.0.1',
            defaultListItem: '10.0.0.1',
          },
        ],
      },
    ],
  },
  firewall: {
    id: 'firewall',
    title: 'Network Firewall',
    description: 'Configure firewall rules, port filtering, and network access policies',
    defaults: {
      defaultPolicy: 'deny',
      enableStatefulInspection: true,
      enableLogging: true,
      allowedPorts: ['80', '443', '22'],
      blockedPorts: [],
      allowedProtocols: ['TCP', 'UDP'],
      enableIntrusionDetection: false,
    },
    sections: [
      {
        id: 'policy',
        title: 'Default Policy',
        fields: [
          {
            id: 'defaultPolicy',
            label: 'Default Policy',
            type: 'select',
            options: [
              { value: 'allow', label: 'Allow All' },
              { value: 'deny', label: 'Deny All' },
            ],
          },
          { id: 'enableStatefulInspection', label: 'Stateful Inspection', type: 'toggle' },
          { id: 'enableLogging', label: 'Enable Logging', type: 'toggle' },
        ],
      },
      {
        id: 'ports',
        title: 'Port Rules',
        fields: [
          {
            id: 'allowedPorts',
            label: 'Allowed Ports',
            type: 'list',
            placeholder: '80',
            defaultListItem: '80',
          },
          {
            id: 'blockedPorts',
            label: 'Blocked Ports',
            type: 'list',
            placeholder: '23',
            defaultListItem: '23',
          },
        ],
      },
      {
        id: 'protocols',
        title: 'Protocols',
        fields: [
          {
            id: 'allowedProtocols',
            label: 'Allowed Protocols',
            type: 'list',
            placeholder: 'TCP',
            defaultListItem: 'TCP',
          },
        ],
      },
      {
        id: 'intrusion',
        title: 'Intrusion Detection',
        fields: [
          { id: 'enableIntrusionDetection', label: 'Enable Intrusion Detection', type: 'toggle' },
        ],
      },
    ],
  },
  'secrets-vault': {
    id: 'secrets-vault',
    title: 'Secrets Vault',
    description: 'Configure secrets management, encryption, and access policies',
    defaults: {
      vaultUrl: 'http://localhost:8200',
      vaultToken: '',
      enableEncryption: true,
      encryptionKey: '',
      enableAuditLogging: true,
      secretTTL: 3600,
      enableAutoRotation: false,
      rotationInterval: 86400,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'vaultUrl', label: 'Vault URL', type: 'text', placeholder: 'http://localhost:8200' },
          { id: 'vaultToken', label: 'Vault Token', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'encryption',
        title: 'Encryption',
        fields: [
          { id: 'enableEncryption', label: 'Enable Encryption', type: 'toggle' },
          { id: 'encryptionKey', label: 'Encryption Key', type: 'password', placeholder: '••••••••' },
        ],
      },
      {
        id: 'secrets',
        title: 'Secret Management',
        fields: [
          { id: 'secretTTL', label: 'Default Secret TTL (seconds)', type: 'number', placeholder: '3600' },
          { id: 'enableAutoRotation', label: 'Enable Auto-Rotation', type: 'toggle' },
          { id: 'rotationInterval', label: 'Rotation Interval (seconds)', type: 'number', placeholder: '86400' },
        ],
      },
      {
        id: 'audit',
        title: 'Audit & Logging',
        fields: [
          { id: 'enableAuditLogging', label: 'Enable Audit Logging', type: 'toggle' },
        ],
      },
    ],
  },
  'ids-ips': {
    id: 'ids-ips',
    title: 'IDS / IPS System',
    description: 'Configure intrusion detection and prevention rules, signatures, and alerting',
    defaults: {
      mode: 'detection',
      enableSignatureMatching: true,
      enableAnomalyDetection: true,
      enableBehavioralAnalysis: false,
      alertThreshold: 'medium',
      enableAutoBlocking: false,
      blockDuration: 3600,
      enableLogging: true,
    },
    sections: [
      {
        id: 'mode',
        title: 'Operation Mode',
        fields: [
          {
            id: 'mode',
            label: 'System Mode',
            type: 'select',
            options: [
              { value: 'disabled', label: 'Disabled' },
              { value: 'detection', label: 'IDS (Detection Only)' },
              { value: 'prevention', label: 'IPS (Prevention)' },
            ],
          },
        ],
      },
      {
        id: 'detection',
        title: 'Detection Methods',
        fields: [
          { id: 'enableSignatureMatching', label: 'Signature Matching', type: 'toggle' },
          { id: 'enableAnomalyDetection', label: 'Anomaly Detection', type: 'toggle' },
          { id: 'enableBehavioralAnalysis', label: 'Behavioral Analysis', type: 'toggle' },
        ],
      },
      {
        id: 'alerting',
        title: 'Alerting',
        fields: [
          {
            id: 'alertThreshold',
            label: 'Alert Threshold',
            type: 'select',
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ],
          },
          { id: 'enableAutoBlocking', label: 'Auto-Block on Detection', type: 'toggle' },
          { id: 'blockDuration', label: 'Block Duration (seconds)', type: 'number', placeholder: '3600' },
        ],
      },
      {
        id: 'logging',
        title: 'Logging',
        fields: [
          { id: 'enableLogging', label: 'Enable Logging', type: 'toggle' },
        ],
      },
    ],
  },
};

