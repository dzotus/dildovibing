import { ComponentProfile } from '../shared/types';

export const SECURITY_PROFILES: Record<string, ComponentProfile> = {
  keycloak: {
    id: 'keycloak',
    title: 'Keycloak',
    description: 'Open-source identity and access management solution with SSO, OAuth2, and SAML support.',
    badge: 'IAM',
    docsUrl: 'https://www.keycloak.org/',
    defaults: {
      realm: 'archiphoenix',
      adminUrl: 'http://keycloak:8080',
      enableSSL: false,
      sslRequired: 'external',
      accessTokenLifespan: 300,
      ssoSessionIdle: 1800,
      ssoSessionMax: 36000,
      enableOAuth2: true,
      enableSAML: false,
      enableLDAP: false,
      passwordPolicy: 'length(8)',
    },
    sections: [
      {
        id: 'realm',
        title: 'Realm Configuration',
        description: 'Keycloak realm and admin settings.',
        fields: [
          {
            id: 'realm',
            label: 'Realm Name',
            type: 'text',
            placeholder: 'my-realm',
          },
          {
            id: 'adminUrl',
            label: 'Admin URL',
            type: 'text',
            placeholder: 'http://keycloak:8080',
          },
        ],
      },
      {
        id: 'ssl',
        title: 'SSL/TLS',
        fields: [
          {
            id: 'enableSSL',
            label: 'Enable SSL',
            type: 'toggle',
          },
          {
            id: 'sslRequired',
            label: 'SSL Required',
            type: 'select',
            options: [
              { label: 'External', value: 'external' },
              { label: 'All', value: 'all' },
              { label: 'None', value: 'none' },
            ],
            description: 'When SSL is required',
          },
        ],
      },
      {
        id: 'sessions',
        title: 'Session Management',
        fields: [
          {
            id: 'accessTokenLifespan',
            label: 'Access Token Lifespan',
            type: 'number',
            min: 60,
            max: 3600,
            suffix: 'sec',
            description: 'How long access tokens are valid',
          },
          {
            id: 'ssoSessionIdle',
            label: 'SSO Session Idle',
            type: 'number',
            min: 60,
            max: 7200,
            suffix: 'sec',
            description: 'Idle timeout for SSO sessions',
          },
          {
            id: 'ssoSessionMax',
            label: 'SSO Session Max',
            type: 'number',
            min: 300,
            max: 86400,
            suffix: 'sec',
            description: 'Maximum SSO session duration',
          },
        ],
      },
      {
        id: 'protocols',
        title: 'Protocols',
        fields: [
          {
            id: 'enableOAuth2',
            label: 'Enable OAuth2',
            type: 'toggle',
          },
          {
            id: 'enableSAML',
            label: 'Enable SAML',
            type: 'toggle',
          },
          {
            id: 'enableLDAP',
            label: 'Enable LDAP',
            type: 'toggle',
            description: 'Connect to LDAP/Active Directory',
          },
        ],
      },
      {
        id: 'password',
        title: 'Password Policy',
        fields: [
          {
            id: 'passwordPolicy',
            label: 'Password Policy',
            type: 'text',
            placeholder: 'length(8) and digits(1)',
            description: 'Keycloak password policy expression',
          },
        ],
      },
    ],
  },
  waf: {
    id: 'waf',
    title: 'Web Application Firewall',
    description: 'Protect applications from common web exploits and attacks.',
    badge: 'Firewall',
    docsUrl: 'https://owasp.org/www-project-web-application-firewall/',
    defaults: {
      mode: 'detection',
      enableOWASP: true,
      owaspRuleset: '3.3',
      enableRateLimiting: true,
      rateLimitPerMinute: 100,
      enableGeoBlocking: false,
      blockedCountries: [],
      enableIPWhitelist: false,
      whitelistedIPs: [],
      enableDDoSProtection: true,
      ddosThreshold: 1000,
    },
    sections: [
      {
        id: 'mode',
        title: 'Operation Mode',
        fields: [
          {
            id: 'mode',
            label: 'Mode',
            type: 'select',
            options: [
              { label: 'Detection', value: 'detection' },
              { label: 'Prevention', value: 'prevention' },
              { label: 'Logging Only', value: 'logging' },
            ],
            description: 'How WAF handles detected threats',
          },
        ],
      },
      {
        id: 'owasp',
        title: 'OWASP Rules',
        fields: [
          {
            id: 'enableOWASP',
            label: 'Enable OWASP Rules',
            type: 'toggle',
            description: 'Use OWASP ModSecurity Core Rule Set',
          },
          {
            id: 'owaspRuleset',
            label: 'OWASP Rule Set Version',
            type: 'select',
            options: [
              { label: '3.3', value: '3.3' },
              { label: '3.2', value: '3.2' },
              { label: '3.1', value: '3.1' },
            ],
          },
        ],
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting',
        fields: [
          {
            id: 'enableRateLimiting',
            label: 'Enable Rate Limiting',
            type: 'toggle',
          },
          {
            id: 'rateLimitPerMinute',
            label: 'Rate Limit',
            type: 'number',
            min: 1,
            max: 10000,
            suffix: 'req/min',
            description: 'Requests per minute per IP',
          },
        ],
      },
      {
        id: 'geo-blocking',
        title: 'Geo-Blocking',
        fields: [
          {
            id: 'enableGeoBlocking',
            label: 'Enable Geo-Blocking',
            type: 'toggle',
          },
          {
            id: 'blockedCountries',
            label: 'Blocked Countries',
            type: 'list',
            description: 'ISO country codes to block',
            defaultListItem: 'XX',
          },
        ],
      },
      {
        id: 'ip-filtering',
        title: 'IP Filtering',
        fields: [
          {
            id: 'enableIPWhitelist',
            label: 'Enable IP Whitelist',
            type: 'toggle',
          },
          {
            id: 'whitelistedIPs',
            label: 'Whitelisted IPs',
            type: 'list',
            description: 'IP addresses or CIDR blocks',
            defaultListItem: '0.0.0.0/0',
          },
        ],
      },
      {
        id: 'ddos',
        title: 'DDoS Protection',
        fields: [
          {
            id: 'enableDDoSProtection',
            label: 'Enable DDoS Protection',
            type: 'toggle',
          },
          {
            id: 'ddosThreshold',
            label: 'DDoS Threshold',
            type: 'number',
            min: 100,
            max: 100000,
            suffix: 'req/sec',
            description: 'Requests per second threshold',
          },
        ],
      },
    ],
  },
  firewall: {
    id: 'firewall',
    title: 'Network Firewall',
    description: 'Network-level firewall for controlling traffic flow and access.',
    badge: 'Network Security',
    defaults: {
      defaultPolicy: 'deny',
      enableStatefulInspection: true,
      enableLogging: true,
      logLevel: 'info',
      allowedPorts: ['80', '443', '22'],
      blockedPorts: [],
      enableVPN: false,
      vpnType: 'ipsec',
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
              { label: 'Deny All', value: 'deny' },
              { label: 'Allow All', value: 'allow' },
            ],
            description: 'Default action for unmatched traffic',
          },
        ],
      },
      {
        id: 'inspection',
        title: 'Inspection & Logging',
        fields: [
          {
            id: 'enableStatefulInspection',
            label: 'Stateful Inspection',
            type: 'toggle',
            description: 'Track connection state',
          },
          {
            id: 'enableLogging',
            label: 'Enable Logging',
            type: 'toggle',
          },
          {
            id: 'logLevel',
            label: 'Log Level',
            type: 'select',
            options: [
              { label: 'Debug', value: 'debug' },
              { label: 'Info', value: 'info' },
              { label: 'Warning', value: 'warning' },
              { label: 'Error', value: 'error' },
            ],
          },
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
            description: 'Ports to allow traffic on',
            defaultListItem: '80',
          },
          {
            id: 'blockedPorts',
            label: 'Blocked Ports',
            type: 'list',
            description: 'Ports to explicitly block',
            defaultListItem: '23',
          },
        ],
      },
      {
        id: 'vpn',
        title: 'VPN',
        fields: [
          {
            id: 'enableVPN',
            label: 'Enable VPN',
            type: 'toggle',
          },
          {
            id: 'vpnType',
            label: 'VPN Type',
            type: 'select',
            options: [
              { label: 'IPSec', value: 'ipsec' },
              { label: 'OpenVPN', value: 'openvpn' },
              { label: 'WireGuard', value: 'wireguard' },
            ],
          },
        ],
      },
    ],
  },
  'secrets-vault': {
    id: 'secrets-vault',
    title: 'Secrets Vault',
    description: 'Secure storage and management of secrets, API keys, and credentials.',
    badge: 'Secrets Management',
    docsUrl: 'https://www.vaultproject.io/',
    defaults: {
      vaultType: 'hashicorp',
      address: 'http://vault:8200',
      enableTLS: false,
      enableTransit: true,
      enableKV: true,
      kvVersion: '2',
      enablePKI: false,
      enableAuth: true,
      authMethod: 'token',
      tokenTTL: '24h',
    },
    sections: [
      {
        id: 'vault',
        title: 'Vault Configuration',
        fields: [
          {
            id: 'vaultType',
            label: 'Vault Type',
            type: 'select',
            options: [
              { label: 'HashiCorp Vault', value: 'hashicorp' },
              { label: 'AWS Secrets Manager', value: 'aws' },
              { label: 'Azure Key Vault', value: 'azure' },
            ],
          },
          {
            id: 'address',
            label: 'Vault Address',
            type: 'text',
            placeholder: 'http://vault:8200',
          },
        ],
      },
      {
        id: 'tls',
        title: 'TLS',
        fields: [
          {
            id: 'enableTLS',
            label: 'Enable TLS',
            type: 'toggle',
            description: 'Encrypt communication with TLS',
          },
        ],
      },
      {
        id: 'engines',
        title: 'Secret Engines',
        fields: [
          {
            id: 'enableTransit',
            label: 'Enable Transit',
            type: 'toggle',
            description: 'Encryption as a service',
          },
          {
            id: 'enableKV',
            label: 'Enable KV Store',
            type: 'toggle',
            description: 'Key-value secret storage',
          },
          {
            id: 'kvVersion',
            label: 'KV Version',
            type: 'select',
            options: [
              { label: 'Version 1', value: '1' },
              { label: 'Version 2', value: '2' },
            ],
          },
          {
            id: 'enablePKI',
            label: 'Enable PKI',
            type: 'toggle',
            description: 'Public Key Infrastructure',
          },
        ],
      },
      {
        id: 'auth',
        title: 'Authentication',
        fields: [
          {
            id: 'enableAuth',
            label: 'Enable Authentication',
            type: 'toggle',
          },
          {
            id: 'authMethod',
            label: 'Auth Method',
            type: 'select',
            options: [
              { label: 'Token', value: 'token' },
              { label: 'AppRole', value: 'approle' },
              { label: 'LDAP', value: 'ldap' },
              { label: 'AWS', value: 'aws' },
            ],
          },
          {
            id: 'tokenTTL',
            label: 'Token TTL',
            type: 'text',
            placeholder: '24h',
            description: 'Token time-to-live (e.g., 24h, 7d)',
          },
        ],
      },
    ],
  },
  'ids-ips': {
    id: 'ids-ips',
    title: 'IDS / IPS',
    description: 'Intrusion Detection and Prevention System for network security monitoring.',
    badge: 'Intrusion Detection',
    defaults: {
      mode: 'ids',
      enableSignatureDetection: true,
      enableAnomalyDetection: true,
      enableBehavioralAnalysis: false,
      alertThreshold: 'medium',
      enableAutoBlock: false,
      blockDuration: 3600,
      enableLogging: true,
      logRetention: 30,
    },
    sections: [
      {
        id: 'mode',
        title: 'Operation Mode',
        fields: [
          {
            id: 'mode',
            label: 'Mode',
            type: 'select',
            options: [
              { label: 'IDS (Detection)', value: 'ids' },
              { label: 'IPS (Prevention)', value: 'ips' },
            ],
            description: 'Detection only or active prevention',
          },
        ],
      },
      {
        id: 'detection',
        title: 'Detection Methods',
        fields: [
          {
            id: 'enableSignatureDetection',
            label: 'Signature Detection',
            type: 'toggle',
            description: 'Detect known attack patterns',
          },
          {
            id: 'enableAnomalyDetection',
            label: 'Anomaly Detection',
            type: 'toggle',
            description: 'Detect unusual network behavior',
          },
          {
            id: 'enableBehavioralAnalysis',
            label: 'Behavioral Analysis',
            type: 'toggle',
            description: 'Machine learning-based detection',
          },
        ],
      },
      {
        id: 'alerting',
        title: 'Alerting & Response',
        fields: [
          {
            id: 'alertThreshold',
            label: 'Alert Threshold',
            type: 'select',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ],
          },
          {
            id: 'enableAutoBlock',
            label: 'Auto Block',
            type: 'toggle',
            description: 'Automatically block detected threats',
          },
          {
            id: 'blockDuration',
            label: 'Block Duration',
            type: 'number',
            min: 60,
            max: 86400,
            suffix: 'sec',
            description: 'How long to block IP addresses',
          },
        ],
      },
      {
        id: 'logging',
        title: 'Logging',
        fields: [
          {
            id: 'enableLogging',
            label: 'Enable Logging',
            type: 'toggle',
          },
          {
            id: 'logRetention',
            label: 'Log Retention',
            type: 'number',
            min: 1,
            max: 365,
            suffix: 'days',
            description: 'How long to retain logs',
          },
        ],
      },
    ],
  },
};

