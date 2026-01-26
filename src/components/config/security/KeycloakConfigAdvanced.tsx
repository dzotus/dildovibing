import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Users, 
  Key, 
  Settings, 
  Plus, 
  Trash2,
  Lock,
  Globe,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Edit,
  ExternalLink,
  Fingerprint,
  Network,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Search,
  Filter
} from 'lucide-react';

interface KeycloakConfigProps {
  componentId: string;
}

interface Client {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'confidential' | 'bearer-only';
  enabled: boolean;
  protocol: 'openid-connect' | 'saml';
  clientId: string;
  clientSecret?: string;
  redirectUris?: string[];
  webOrigins?: string[];
  grantTypes?: string[];
  accessType?: 'public' | 'confidential' | 'bearer-only';
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  authorizationServicesEnabled?: boolean;
  consentRequired?: boolean;
  protocolMappers?: Array<{
    id: string;
    name: string;
    protocol: string;
    protocolMapper: string;
    config: Record<string, string>;
  }>;
  defaultClientScopes?: string[];
  optionalClientScopes?: string[];
  roles?: string[];
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified?: boolean;
  roles: string[];
  groups?: string[];
  attributes?: Record<string, string[]>;
  credentials?: Array<{
    type: string;
    value: string;
    temporary: boolean;
  }>;
  federatedIdentity?: Array<{
    identityProvider: string;
    userId: string;
    userName: string;
  }>;
}

interface AuthenticationFlow {
  id: string;
  alias: string;
  description?: string;
  providerId: string;
  topLevel: boolean;
  builtIn: boolean;
  executions?: Array<{
    id: string;
    requirement: 'REQUIRED' | 'ALTERNATIVE' | 'DISABLED' | 'CONDITIONAL';
    displayName: string;
    configurable: boolean;
    providerId: string;
  }>;
}

interface IdentityProvider {
  id: string;
  alias: string;
  providerId: 'google' | 'github' | 'facebook' | 'saml' | 'oidc' | 'ldap';
  enabled: boolean;
  displayName?: string;
  config?: Record<string, string>;
}

interface ClientScope {
  id: string;
  name: string;
  description?: string;
  protocol: 'openid-connect' | 'saml';
  attributes?: Record<string, string>;
  protocolMappers?: Array<{
    id: string;
    name: string;
    protocolMapper: string;
    config: Record<string, string>;
  }>;
}

interface KeycloakConfig {
  realm?: string;
  adminUrl?: string;
  enabled?: boolean;
  displayName?: string;
  displayNameHtml?: string;
  enableSSL?: boolean;
  sslRequired?: string;
  accessTokenLifespan?: number;
  ssoSessionIdle?: number;
  ssoSessionMax?: number;
  refreshTokenLifespan?: number;
  enableOAuth2?: boolean;
  enableSAML?: boolean;
  enableLDAP?: boolean;
  passwordPolicy?: string;
  clients?: Client[];
  users?: User[];
  authenticationFlows?: AuthenticationFlow[];
  identityProviders?: IdentityProvider[];
  clientScopes?: ClientScope[];
  realmRoles?: string[];
  groups?: Array<{ id: string; name: string; path: string; subGroups?: Array<{ id: string; name: string; path: string }> }>;
  themes?: {
    loginTheme?: string;
    accountTheme?: string;
    adminTheme?: string;
    emailTheme?: string;
  };
  email?: {
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
  };
  events?: {
    enabled?: boolean;
    eventsEnabled?: boolean;
    adminEventsEnabled?: boolean;
    eventsExpiration?: number;
    adminEventsDetailsEnabled?: boolean;
  };
}

export function KeycloakConfigAdvanced({ componentId }: KeycloakConfigProps) {
  const { nodes, connections, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KeycloakConfig;
  const realm = config.realm || 'archiphoenix';
  const adminUrl = config.adminUrl || 'http://keycloak:8080';
  const enabled = config.enabled ?? true;
  
  // Check if component has any connections (incoming or outgoing)
  const hasConnections = connections.some(
    conn => conn.source === componentId || conn.target === componentId
  );
  
  // Component is truly active only if it's enabled AND has connections
  const isActive = enabled && hasConnections;
  const enableSSL = config.enableSSL ?? false;
  const sslRequired = config.sslRequired || 'external';
  const accessTokenLifespan = config.accessTokenLifespan || 300;
  const ssoSessionIdle = config.ssoSessionIdle || 1800;
  const ssoSessionMax = config.ssoSessionMax || 36000;
  const refreshTokenLifespan = config.refreshTokenLifespan || 1800;
  const enableOAuth2 = config.enableOAuth2 ?? true;
  const enableSAML = config.enableSAML ?? false;
  const enableLDAP = config.enableLDAP ?? false;
  const passwordPolicy = config.passwordPolicy || 'length(8)';
  
  const clients = config.clients || [
    { 
      id: 'archiphoenix-app', 
      name: 'ArchiPhoenix App', 
      clientId: 'archiphoenix-app',
      type: 'public', 
      enabled: true, 
      protocol: 'openid-connect',
      redirectUris: ['http://localhost:3000/*'],
      webOrigins: ['http://localhost:3000'],
      grantTypes: ['authorization_code', 'refresh_token'],
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
    },
    { 
      id: 'admin-cli', 
      name: 'Admin CLI', 
      clientId: 'admin-cli',
      type: 'public', 
      enabled: true, 
      protocol: 'openid-connect',
      grantTypes: ['client_credentials'],
      serviceAccountsEnabled: true,
    },
  ];
  
  const users = config.users || [
    { 
      id: '1', 
      username: 'admin', 
      email: 'admin@archiphoenix.com', 
      firstName: 'Admin',
      lastName: 'User',
      enabled: true, 
      emailVerified: true,
      roles: ['admin', 'user'],
      groups: [],
      attributes: {},
    },
    { 
      id: '2', 
      username: 'user1', 
      email: 'user1@archiphoenix.com',
      firstName: 'John',
      lastName: 'Doe',
      enabled: true, 
      emailVerified: false,
      roles: ['user'],
      groups: [],
      attributes: {},
    },
  ];

  const authenticationFlows = config.authenticationFlows || [
    {
      id: 'browser',
      alias: 'browser',
      description: 'Browser based authentication',
      providerId: 'basic-flow',
      topLevel: true,
      builtIn: true,
      executions: [
        { id: 'cookie', requirement: 'ALTERNATIVE', displayName: 'Cookie', configurable: false, providerId: 'auth-cookie' },
        { id: 'identity-provider-redirector', requirement: 'ALTERNATIVE', displayName: 'Identity Provider Redirector', configurable: true, providerId: 'identity-provider-redirector' },
        { id: 'forms', requirement: 'ALTERNATIVE', displayName: 'Forms', configurable: false, providerId: 'auth-username-password-form' },
      ],
    },
    {
      id: 'direct-grant',
      alias: 'direct grant',
      description: 'Direct grant authentication',
      providerId: 'basic-flow',
      topLevel: true,
      builtIn: true,
      executions: [
        { id: 'username-password', requirement: 'REQUIRED', displayName: 'Username Password Form', configurable: false, providerId: 'direct-grant-validate-username-password' },
      ],
    },
  ];

  const identityProviders = config.identityProviders || [];
  const clientScopes = config.clientScopes || [
    { id: 'profile', name: 'profile', protocol: 'openid-connect', description: 'OpenID Connect built-in scope: profile' },
    { id: 'email', name: 'email', protocol: 'openid-connect', description: 'OpenID Connect built-in scope: email' },
    { id: 'roles', name: 'roles', protocol: 'openid-connect', description: 'OpenID Connect scope for add user roles to the access token' },
  ];
  const realmRoles = config.realmRoles || ['admin', 'user', 'viewer'];
  const groups = config.groups || [];

  const { toast } = useToast();
  const [activeSessions, setActiveSessions] = useState(0);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [newPassword, setNewPassword] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState<Record<string, boolean>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  
  // Real-time metrics from emulation engine
  const [realMetrics, setRealMetrics] = useState<{
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
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    authSuccessRate: number;
  } | null>(null);
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Get metrics from emulation engine in real-time
  useEffect(() => {
    const updateMetrics = () => {
      try {
        const keycloakEngine = emulationEngine.getKeycloakEmulationEngine(node.id);
        if (keycloakEngine) {
          const metrics = keycloakEngine.getMetrics();
          const load = keycloakEngine.calculateLoad();
          
          if (metrics) {
            setRealMetrics({
              ...metrics,
              ...load,
            });
            setActiveSessions(metrics.activeSessions || 0);
            return;
          }
        }
      } catch (e) {
        // Fallback to heuristic
      }
      // Heuristic: enabled users * 2 sessions per user
      const heuristicSessions = users.filter(u => u.enabled).length * 2;
      setActiveSessions(heuristicSessions);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000); // Update every second
    return () => clearInterval(interval);
  }, [node.id, users]);

  // Validation functions
  const validateRedirectUri = (uri: string): string | null => {
    if (!uri || !uri.trim()) return null;
    
    // Allow wildcards
    const uriPattern = /^(https?:\/\/)?([\w\-\.]+|\*)(:\d+)?(\/.*)?(\*)?$/;
    if (!uriPattern.test(uri.trim())) {
      return 'Invalid redirect URI format. Use http:// or https:// with optional wildcards';
    }
    
    return null;
  };

  const validateEmail = (email: string): string | null => {
    if (!email || !email.trim()) return null;
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      return 'Invalid email format';
    }
    
    return null;
  };

  const validateClientScope = (scopeId: string, clientScopes: ClientScope[]): string | null => {
    if (!scopeId || !scopeId.trim()) return null;
    
    const scopeExists = clientScopes.some(s => s.id === scopeId || s.name === scopeId);
    if (!scopeExists) {
      return `Client scope "${scopeId}" does not exist`;
    }
    
    return null;
  };

  const validateSmtpHost = (host: string): string | null => {
    if (!host || !host.trim()) return null;
    
    const hostPattern = /^([\w\-\.]+|\[[\w:\.]+\])$/;
    if (!hostPattern.test(host.trim())) {
      return 'Invalid SMTP host format';
    }
    
    return null;
  };

  const validateSmtpPort = (port: number): string | null => {
    if (port < 1 || port > 65535) {
      return 'SMTP port must be between 1 and 65535';
    }
    
    return null;
  };

  const updateConfig = (updates: Partial<KeycloakConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Sync with emulation engine immediately
    try {
      const keycloakEngine = emulationEngine.getKeycloakEmulationEngine(node.id);
      if (keycloakEngine) {
        keycloakEngine.initializeConfig({
          ...node,
          data: {
            ...node.data,
            config: newConfig,
          },
        });
      }
    } catch (e) {
      // Silently fail - emulation will sync on next updateMetrics call
    }
  };

  const addClient = () => {
    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: 'New Client',
      clientId: `new-client-${Date.now()}`,
      type: 'public',
      enabled: true,
      protocol: 'openid-connect',
      redirectUris: [],
      webOrigins: [],
      grantTypes: ['authorization_code'],
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      authorizationServicesEnabled: false,
      consentRequired: false,
      protocolMappers: [],
      defaultClientScopes: ['profile', 'email'],
      optionalClientScopes: [],
      roles: [],
    };
    updateConfig({
      clients: [...clients, newClient],
    });
    setSelectedClient(clients.length);
  };

  const updateClient = (index: number, updates: Partial<Client>) => {
    const updatedClients = [...clients];
    updatedClients[index] = { ...updatedClients[index], ...updates };
    updateConfig({ clients: updatedClients });
  };

  const removeClient = (index: number) => {
    updateConfig({ clients: clients.filter((_, i) => i !== index) });
    if (selectedClient === index) setSelectedClient(null);
  };

  const addUser = () => {
    const newUser: User = {
      id: String(Date.now()),
      username: `user${users.length + 1}`,
      email: `user${users.length + 1}@example.com`,
      enabled: true,
      emailVerified: false,
      roles: ['user'],
      groups: [],
      attributes: {},
      credentials: [],
      federatedIdentity: [],
    };
    updateConfig({
      users: [...users, newUser],
    });
    setSelectedUser(users.length);
  };

  const updateUser = (index: number, updates: Partial<User>) => {
    const updatedUsers = [...users];
    updatedUsers[index] = { ...updatedUsers[index], ...updates };
    updateConfig({ users: updatedUsers });
  };

  const removeUser = (index: number) => {
    updateConfig({ users: users.filter((_, i) => i !== index) });
    if (selectedUser === index) setSelectedUser(null);
  };

  // Protocol Mapper handlers
  const addProtocolMapper = (clientIndex: number) => {
    const mapper = {
      id: `mapper-${Date.now()}`,
      name: 'New Mapper',
      protocol: clients[clientIndex].protocol,
      protocolMapper: 'oidc-usermodel-property-mapper',
      config: {},
    };
    const updatedMappers = [...(clients[clientIndex].protocolMappers || []), mapper];
    updateClient(clientIndex, { protocolMappers: updatedMappers });
    toast({
      title: 'Protocol Mapper Added',
      description: 'New protocol mapper has been added to the client',
    });
  };

  const removeProtocolMapper = (clientIndex: number, mapperIndex: number) => {
    const updatedMappers = (clients[clientIndex].protocolMappers || []).filter((_, i) => i !== mapperIndex);
    updateClient(clientIndex, { protocolMappers: updatedMappers });
    toast({
      title: 'Protocol Mapper Removed',
      description: 'Protocol mapper has been removed from the client',
    });
  };

  const updateProtocolMapper = (clientIndex: number, mapperIndex: number, updates: Partial<Client['protocolMappers'][0]>) => {
    const updatedMappers = [...(clients[clientIndex].protocolMappers || [])];
    updatedMappers[mapperIndex] = { ...updatedMappers[mapperIndex], ...updates };
    updateClient(clientIndex, { protocolMappers: updatedMappers });
  };

  // User Attribute handlers
  const addUserAttribute = (userIndex: number) => {
    const newKey = `attribute-${Date.now()}`;
    const updatedAttributes = {
      ...(users[userIndex].attributes || {}),
      [newKey]: [''],
    };
    updateUser(userIndex, { attributes: updatedAttributes });
    toast({
      title: 'Attribute Added',
      description: 'New attribute has been added to the user',
    });
  };

  const removeUserAttribute = (userIndex: number, key: string) => {
    const updatedAttributes = { ...(users[userIndex].attributes || {}) };
    delete updatedAttributes[key];
    updateUser(userIndex, { attributes: updatedAttributes });
    toast({
      title: 'Attribute Removed',
      description: 'Attribute has been removed from the user',
    });
  };

  const updateUserAttribute = (userIndex: number, oldKey: string, newKey: string, values: string[]) => {
    const updatedAttributes = { ...(users[userIndex].attributes || {}) };
    if (oldKey !== newKey) {
      delete updatedAttributes[oldKey];
    }
    updatedAttributes[newKey] = values;
    updateUser(userIndex, { attributes: updatedAttributes });
  };

  // User Credential handlers
  const setUserPassword = (userIndex: number, password: string, temporary: boolean) => {
    const newCredential = {
      type: 'password',
      value: password,
      temporary,
    };
    const updatedCredentials = [...(users[userIndex].credentials || []), newCredential];
    updateUser(userIndex, { credentials: updatedCredentials });
    setNewPassword({ ...newPassword, [userIndex]: '' });
    setTemporaryPassword({ ...temporaryPassword, [userIndex]: false });
    toast({
      title: 'Password Set',
      description: temporary ? 'Temporary password has been set' : 'Password has been set',
    });
  };

  const removeUserCredential = (userIndex: number, credIndex: number) => {
    const updatedCredentials = (users[userIndex].credentials || []).filter((_, i) => i !== credIndex);
    updateUser(userIndex, { credentials: updatedCredentials });
    toast({
      title: 'Credential Removed',
      description: 'Credential has been removed from the user',
    });
  };

  // Identity Provider handlers
  const addIdentityProvider = (providerId: 'google' | 'github' | 'facebook' | 'saml' | 'oidc' | 'ldap') => {
    const newProvider: IdentityProvider = {
      id: `idp-${Date.now()}`,
      alias: providerId,
      providerId,
      enabled: true,
      displayName: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      config: {},
    };
    updateConfig({
      identityProviders: [...identityProviders, newProvider],
    });
    toast({
      title: 'Identity Provider Added',
      description: `${newProvider.displayName} identity provider has been added`,
    });
  };

  const updateIdentityProvider = (index: number, updates: Partial<IdentityProvider>) => {
    const updatedProviders = [...identityProviders];
    updatedProviders[index] = { ...updatedProviders[index], ...updates };
    updateConfig({ identityProviders: updatedProviders });
  };

  const removeIdentityProvider = (index: number) => {
    updateConfig({ identityProviders: identityProviders.filter((_, i) => i !== index) });
    toast({
      title: 'Identity Provider Removed',
      description: 'Identity provider has been removed',
    });
  };

  // Client Scope handlers
  const addClientScope = () => {
    const newScope: ClientScope = {
      id: `scope-${Date.now()}`,
      name: `new-scope-${Date.now()}`,
      protocol: 'openid-connect',
      description: 'Custom client scope',
      attributes: {},
      protocolMappers: [],
    };
    updateConfig({
      clientScopes: [...clientScopes, newScope],
    });
    toast({
      title: 'Client Scope Created',
      description: 'New client scope has been created',
    });
  };

  const removeClientScope = (index: number) => {
    updateConfig({ clientScopes: clientScopes.filter((_, i) => i !== index) });
    toast({
      title: 'Client Scope Removed',
      description: 'Client scope has been removed',
    });
  };

  // Role handlers
  const addRealmRole = () => {
    const newRole = `role-${Date.now()}`;
    updateConfig({
      realmRoles: [...realmRoles, newRole],
    });
    toast({
      title: 'Role Created',
      description: 'New realm role has been created',
    });
  };

  const removeRealmRole = (role: string) => {
    updateConfig({ realmRoles: realmRoles.filter(r => r !== role) });
    // Also remove from all users
    const updatedUsers = users.map(user => ({
      ...user,
      roles: user.roles.filter(r => r !== role),
    }));
    updateConfig({ users: updatedUsers });
    toast({
      title: 'Role Removed',
      description: 'Realm role has been removed',
    });
  };

  const copyClientSecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({
      title: 'Copied',
      description: 'Client secret has been copied to clipboard',
    });
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.clientId.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.firstName && u.firstName.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.lastName && u.lastName.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Keycloak</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Identity and Access Management - {realm}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "default" : "secondary"} className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {isActive ? 'Active' : hasConnections ? 'Connected' : 'Standalone'}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{clients.filter(c => c.enabled).length} enabled</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{users.filter(u => u.enabled).length} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Real-time Metrics */}
        {realMetrics && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Metrics
              </CardTitle>
              <CardDescription>Live performance metrics from Keycloak simulation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Requests Per Second</Label>
                  <div className="text-3xl font-bold">{realMetrics.requestsPerSecond.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Current throughput</p>
                </div>
                <div className="space-y-2">
                  <Label>Average Latency</Label>
                  <div className="text-3xl font-bold">{Math.round(realMetrics.averageLatency)}ms</div>
                  <p className="text-sm text-muted-foreground">Response time</p>
                </div>
                <div className="space-y-2">
                  <Label>Error Rate</Label>
                  <div className="text-3xl font-bold">{(realMetrics.errorRate * 100).toFixed(2)}%</div>
                  <p className="text-sm text-muted-foreground">Failed requests</p>
                </div>
                <div className="space-y-2">
                  <Label>Auth Success Rate</Label>
                  <div className="text-3xl font-bold">{(realMetrics.authSuccessRate * 100).toFixed(2)}%</div>
                  <p className="text-sm text-muted-foreground">Successful authentications</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Login Requests</Label>
                  <div className="text-xl font-bold">{realMetrics.loginRequestsTotal}</div>
                  <p className="text-xs text-muted-foreground">{realMetrics.loginErrorsTotal} errors</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Token Refresh</Label>
                  <div className="text-xl font-bold">{realMetrics.tokenRefreshTotal}</div>
                  <p className="text-xs text-muted-foreground">Refresh operations</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Sessions</Label>
                  <div className="text-xl font-bold">{realMetrics.activeSessions}</div>
                  <p className="text-xs text-muted-foreground">{realMetrics.sessionsCreatedTotal} created, {realMetrics.sessionsExpiredTotal} expired</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Events</Label>
                  <div className="text-xl font-bold">{realMetrics.eventsTotal}</div>
                  <p className="text-xs text-muted-foreground">{realMetrics.adminEventsTotal} admin events</p>
                </div>
              </div>
              {config.email && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Emails Sent</Label>
                      <div className="text-xl font-bold">{realMetrics.emailsSentTotal}</div>
                      <p className="text-xs text-muted-foreground">{realMetrics.emailErrorsTotal} errors</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Email Error Rate</Label>
                      <div className="text-xl font-bold">
                        {realMetrics.emailsSentTotal > 0 
                          ? ((realMetrics.emailErrorsTotal / realMetrics.emailsSentTotal) * 100).toFixed(2)
                          : '0.00'}%
                      </div>
                      <p className="text-xs text-muted-foreground">SMTP errors</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="realm" className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="realm" className="gap-2">
              <Globe className="h-4 w-4" />
              Realm
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Key className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="authentication" className="gap-2">
              <Fingerprint className="h-4 w-4" />
              Auth Flows
            </TabsTrigger>
            <TabsTrigger value="identity-providers" className="gap-2">
              <Network className="h-4 w-4" />
              IdP
            </TabsTrigger>
            <TabsTrigger value="client-scopes" className="gap-2">
              <Settings className="h-4 w-4" />
              Scopes
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Clock className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Realm Tab */}
          <TabsContent value="realm" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Realm Settings</CardTitle>
                <CardDescription>Keycloak realm configuration and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="realm">Realm Name *</Label>
                    <Input
                      id="realm"
                      value={realm}
                      onChange={(e) => updateConfig({ realm: e.target.value })}
                      placeholder="my-realm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-url">Admin URL</Label>
                    <Input
                      id="admin-url"
                      value={adminUrl}
                      onChange={(e) => updateConfig({ adminUrl: e.target.value })}
                      placeholder="http://keycloak:8080"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input
                      id="display-name"
                      value={config.displayName || ''}
                      onChange={(e) => updateConfig({ displayName: e.target.value })}
                      placeholder="My Realm"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <div className="space-y-0.5">
                      <Label>Realm Enabled</Label>
                      <div className="text-sm text-muted-foreground">Enable or disable this realm</div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => updateConfig({ enabled: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Email Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email
                </CardTitle>
                <CardDescription>Configure SMTP server for sending emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      value={config.email?.host || ''}
                      onChange={(e) => {
                        const host = e.target.value;
                        const error = validateSmtpHost(host);
                        if (error) {
                          setValidationErrors({
                            ...validationErrors,
                            'smtp-host': error,
                          });
                        } else {
                          const newErrors = { ...validationErrors };
                          delete newErrors['smtp-host'];
                          setValidationErrors(newErrors);
                        }
                        updateConfig({ 
                          email: { ...config.email, host } 
                        });
                      }}
                      placeholder="smtp.example.com"
                      className={validationErrors['smtp-host'] ? 'border-red-500' : ''}
                    />
                    {validationErrors['smtp-host'] && (
                      <p className="text-xs text-red-500">{validationErrors['smtp-host']}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      value={config.email?.port || 587}
                      onChange={(e) => {
                        const port = parseInt(e.target.value) || 587;
                        const error = validateSmtpPort(port);
                        if (error) {
                          setValidationErrors({
                            ...validationErrors,
                            'smtp-port': error,
                          });
                        } else {
                          const newErrors = { ...validationErrors };
                          delete newErrors['smtp-port'];
                          setValidationErrors(newErrors);
                        }
                        updateConfig({ 
                          email: { ...config.email, port } 
                        });
                      }}
                      className={validationErrors['smtp-port'] ? 'border-red-500' : ''}
                    />
                    {validationErrors['smtp-port'] && (
                      <p className="text-xs text-red-500">{validationErrors['smtp-port']}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from">From</Label>
                    <Input
                      id="smtp-from"
                      value={config.email?.from || ''}
                      onChange={(e) => {
                        const from = e.target.value;
                        const error = validateEmail(from);
                        if (error && from.trim()) {
                          setValidationErrors({
                            ...validationErrors,
                            'smtp-from': error,
                          });
                        } else {
                          const newErrors = { ...validationErrors };
                          delete newErrors['smtp-from'];
                          setValidationErrors(newErrors);
                        }
                        updateConfig({ 
                          email: { ...config.email, from } 
                        });
                      }}
                      placeholder="noreply@example.com"
                      className={validationErrors['smtp-from'] ? 'border-red-500' : ''}
                    />
                    {validationErrors['smtp-from'] && (
                      <p className="text-xs text-red-500">{validationErrors['smtp-from']}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-display">From Display Name</Label>
                    <Input
                      id="smtp-from-display"
                      value={config.email?.fromDisplayName || ''}
                      onChange={(e) => updateConfig({ 
                        email: { ...config.email, fromDisplayName: e.target.value } 
                      })}
                      placeholder="Keycloak"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.email?.enableSsl ?? false}
                      onCheckedChange={(checked) => updateConfig({ 
                        email: { ...config.email, enableSsl: checked } 
                      })}
                    />
                    <Label>Enable SSL</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.email?.enableStartTls ?? false}
                      onCheckedChange={(checked) => updateConfig({ 
                        email: { ...config.email, enableStartTls: checked } 
                      })}
                    />
                    <Label>Enable StartTLS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.email?.enableAuthentication ?? false}
                      onCheckedChange={(checked) => updateConfig({ 
                        email: { ...config.email, enableAuthentication: checked } 
                      })}
                    />
                    <Label>Enable Authentication</Label>
                  </div>
                </div>
                {config.email?.enableAuthentication && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-user">Username</Label>
                      <Input
                        id="smtp-user"
                        value={config.email?.user || ''}
                        onChange={(e) => updateConfig({ 
                          email: { ...config.email, user: e.target.value } 
                        })}
                        placeholder="smtp-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">Password</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={config.email?.password || ''}
                        onChange={(e) => updateConfig({ 
                          email: { ...config.email, password: e.target.value } 
                        })}
                        placeholder="smtp-password"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab - Enhanced */}
          <TabsContent value="clients" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>OAuth2 and OpenID Connect clients</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button size="sm" onClick={addClient} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Client
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredClients.map((client, index) => (
                    <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded bg-primary/10">
                              <Key className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{client.name}</CardTitle>
                                {client.description && (
                                  <span className="text-sm text-muted-foreground">- {client.description}</span>
                                )}
                              </div>
                              <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                <span>Client ID: {client.clientId}</span>
                                <span>•</span>
                                <span>{client.type}</span>
                                <span>•</span>
                                <span>{client.protocol}</span>
                                {client.redirectUris && client.redirectUris.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{client.redirectUris.length} redirect URI{client.redirectUris.length !== 1 ? 's' : ''}</span>
                                  </>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {client.enabled ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Enabled
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Disabled
                              </Badge>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSelectedClient(index)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Client: {client.name}</DialogTitle>
                                  <DialogDescription>
                                    Configure client settings, credentials, and protocol mappers
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 mt-4">
                                  <Tabs defaultValue="settings">
                                    <TabsList>
                                      <TabsTrigger value="settings">Settings</TabsTrigger>
                                      <TabsTrigger value="credentials">Credentials</TabsTrigger>
                                      <TabsTrigger value="protocol-mappers">Protocol Mappers</TabsTrigger>
                                      <TabsTrigger value="scopes">Scopes</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="settings" className="space-y-4 mt-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="client-name">Client Name *</Label>
                                          <Input
                                            id="client-name"
                                            value={client.name}
                                            onChange={(e) => updateClient(index, { name: e.target.value })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="client-id">Client ID *</Label>
                                          <Input
                                            id="client-id"
                                            value={client.clientId}
                                            onChange={(e) => updateClient(index, { clientId: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="client-description">Description</Label>
                                        <Textarea
                                          id="client-description"
                                          value={client.description || ''}
                                          onChange={(e) => updateClient(index, { description: e.target.value })}
                                          rows={2}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                          <Label>Enabled</Label>
                                          <div className="text-sm text-muted-foreground">Enable or disable this client</div>
                                        </div>
                                        <Switch
                                          checked={client.enabled}
                                          onCheckedChange={(checked) => updateClient(index, { enabled: checked })}
                                        />
                                      </div>
                                      <Separator />
                                      <div className="space-y-2">
                                        <Label>Client Protocol</Label>
                                        <Select 
                                          value={client.protocol} 
                                          onValueChange={(value: 'openid-connect' | 'saml') => updateClient(index, { protocol: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="openid-connect">OpenID Connect</SelectItem>
                                            <SelectItem value="saml">SAML 2.0</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Access Type</Label>
                                        <Select 
                                          value={client.type} 
                                          onValueChange={(value: 'public' | 'confidential' | 'bearer-only') => updateClient(index, { type: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="public">Public</SelectItem>
                                            <SelectItem value="confidential">Confidential</SelectItem>
                                            <SelectItem value="bearer-only">Bearer-only</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Separator />
                                      <div className="space-y-3">
                                        <Label>Capability Config</Label>
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-normal">Standard Flow Enabled</Label>
                                            <Switch
                                              checked={client.standardFlowEnabled ?? true}
                                              onCheckedChange={(checked) => updateClient(index, { standardFlowEnabled: checked })}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-normal">Direct Access Grants Enabled</Label>
                                            <Switch
                                              checked={client.directAccessGrantsEnabled ?? false}
                                              onCheckedChange={(checked) => updateClient(index, { directAccessGrantsEnabled: checked })}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-normal">Service Accounts Enabled</Label>
                                            <Switch
                                              checked={client.serviceAccountsEnabled ?? false}
                                              onCheckedChange={(checked) => updateClient(index, { serviceAccountsEnabled: checked })}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-normal">Authorization Services Enabled</Label>
                                            <Switch
                                              checked={client.authorizationServicesEnabled ?? false}
                                              onCheckedChange={(checked) => updateClient(index, { authorizationServicesEnabled: checked })}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <Label className="text-sm font-normal">Consent Required</Label>
                                            <Switch
                                              checked={client.consentRequired ?? false}
                                              onCheckedChange={(checked) => updateClient(index, { consentRequired: checked })}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <Separator />
                                      <div className="space-y-2">
                                        <Label htmlFor="redirect-uris">Valid Redirect URIs</Label>
                                        <Textarea
                                          id="redirect-uris"
                                          value={client.redirectUris?.join('\n') || ''}
                                          onChange={(e) => {
                                            const uris = e.target.value.split('\n').filter(u => u.trim());
                                            const errors: string[] = [];
                                            
                                            uris.forEach((uri, idx) => {
                                              const error = validateRedirectUri(uri);
                                              if (error) {
                                                errors.push(`URI ${idx + 1}: ${error}`);
                                              }
                                            });
                                            
                                            if (errors.length > 0) {
                                              setValidationErrors({
                                                ...validationErrors,
                                                [`client-${index}-redirect-uris`]: errors.join('; '),
                                              });
                                            } else {
                                              const newErrors = { ...validationErrors };
                                              delete newErrors[`client-${index}-redirect-uris`];
                                              setValidationErrors(newErrors);
                                            }
                                            
                                            updateClient(index, { redirectUris: uris });
                                          }}
                                          placeholder="http://localhost:3000/*&#10;https://example.com/callback"
                                          rows={4}
                                          className={validationErrors[`client-${index}-redirect-uris`] ? 'border-red-500' : ''}
                                        />
                                        {validationErrors[`client-${index}-redirect-uris`] && (
                                          <p className="text-xs text-red-500">
                                            {validationErrors[`client-${index}-redirect-uris`]}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                          One URI per line. Use * for wildcards
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="web-origins">Web Origins</Label>
                                        <Textarea
                                          id="web-origins"
                                          value={client.webOrigins?.join('\n') || ''}
                                          onChange={(e) => updateClient(index, { 
                                            webOrigins: e.target.value.split('\n').filter(o => o.trim()) 
                                          })}
                                          placeholder="http://localhost:3000&#10;https://example.com"
                                          rows={3}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                          Allowed CORS origins. Use + for all origins, * for all redirect URIs
                                        </p>
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="credentials" className="space-y-4 mt-4">
                                      {client.type === 'confidential' && (
                                        <div className="space-y-2">
                                          <Label htmlFor="client-secret">Client Secret</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              id="client-secret"
                                              type={showSecret[`client-${index}`] ? "text" : "password"}
                                              value={client.clientSecret || ''}
                                              onChange={(e) => updateClient(index, { clientSecret: e.target.value })}
                                              placeholder="Enter client secret"
                                            />
                                            <Button 
                                              variant="outline" 
                                              size="icon"
                                              onClick={() => setShowSecret({ ...showSecret, [`client-${index}`]: !showSecret[`client-${index}`] })}
                                            >
                                              {showSecret[`client-${index}`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button 
                                              variant="outline" 
                                              size="icon"
                                              onClick={() => {
                                                if (client.clientSecret) {
                                                  copyClientSecret(client.clientSecret);
                                                }
                                              }}
                                            >
                                              <Copy className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            Keep this secret secure. It's used to authenticate the client.
                                          </p>
                                        </div>
                                      )}
                                      {client.type === 'public' && (
                                        <div className="p-4 bg-muted rounded-lg">
                                          <p className="text-sm text-muted-foreground">
                                            Public clients don't require a client secret. They are typically used for browser-based applications.
                                          </p>
                                        </div>
                                      )}
                                    </TabsContent>
                                    
                                    <TabsContent value="protocol-mappers" className="space-y-4 mt-4">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">
                                          Protocol mappers allow you to add claims to tokens or transform user data
                                        </p>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => addProtocolMapper(index)}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add Mapper
                                        </Button>
                                      </div>
                                      {client.protocolMappers && client.protocolMappers.length > 0 ? (
                                        <div className="space-y-2">
                                          {client.protocolMappers.map((mapper, i) => (
                                            <Card key={i} className="p-3">
                                              <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                  <div className="font-medium">{mapper.name}</div>
                                                  <div className="text-xs text-muted-foreground">{mapper.protocolMapper}</div>
                                                </div>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost"
                                                  onClick={() => removeProtocolMapper(index, i)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </Card>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                                          No protocol mappers configured
                                        </div>
                                      )}
                                    </TabsContent>
                                    
                                    <TabsContent value="scopes" className="space-y-4 mt-4">
                                      <div className="space-y-4">
                                        <div>
                                          <Label>Default Client Scopes</Label>
                                          <p className="text-xs text-muted-foreground mb-2">
                                            These scopes are always included in tokens
                                          </p>
                                          <div className="space-y-2">
                                            {clientScopes.filter(s => client.defaultClientScopes?.includes(s.id)).map(scope => (
                                              <Badge key={scope.id} variant="default">{scope.name}</Badge>
                                            ))}
                                            {(!client.defaultClientScopes || client.defaultClientScopes.length === 0) && (
                                              <p className="text-sm text-muted-foreground">No default scopes</p>
                                            )}
                                          </div>
                                        </div>
                                        <div>
                                          <Label>Optional Client Scopes</Label>
                                          <p className="text-xs text-muted-foreground mb-2">
                                            These scopes can be requested by the client
                                          </p>
                                          <div className="space-y-2">
                                            {clientScopes.filter(s => client.optionalClientScopes?.includes(s.id)).map(scope => (
                                              <Badge key={scope.id} variant="outline">{scope.name}</Badge>
                                            ))}
                                            {(!client.optionalClientScopes || client.optionalClientScopes.length === 0) && (
                                              <p className="text-sm text-muted-foreground">No optional scopes</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {clients.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeClient(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                      {clientSearch ? 'No clients found matching your search' : 'No clients configured'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab - Enhanced */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>User accounts and role mappings</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button size="sm" onClick={addUser} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredUsers.map((user, index) => (
                    <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded-full bg-secondary">
                              <Users className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">
                                  {user.firstName && user.lastName 
                                    ? `${user.firstName} ${user.lastName}` 
                                    : user.username}
                                </CardTitle>
                                {user.emailVerified && (
                                  <Badge variant="outline" className="text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="text-xs mt-1">
                                {user.email}
                                {user.firstName || user.lastName && (
                                  <span className="ml-2">({user.username})</span>
                                )}
                              </CardDescription>
                              <div className="flex gap-1 mt-2">
                                {user.roles.map((role, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.enabled ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Disabled
                              </Badge>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSelectedUser(index)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit User: {user.username}</DialogTitle>
                                  <DialogDescription>
                                    Configure user details, credentials, roles, and attributes
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 mt-4">
                                  <Tabs defaultValue="details">
                                    <TabsList>
                                      <TabsTrigger value="details">Details</TabsTrigger>
                                      <TabsTrigger value="credentials">Credentials</TabsTrigger>
                                      <TabsTrigger value="role-mappings">Role Mappings</TabsTrigger>
                                      <TabsTrigger value="groups">Groups</TabsTrigger>
                                      <TabsTrigger value="attributes">Attributes</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="details" className="space-y-4 mt-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="username">Username *</Label>
                                          <Input
                                            id="username"
                                            value={user.username}
                                            onChange={(e) => updateUser(index, { username: e.target.value })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="email">Email *</Label>
                                          <Input
                                            id="email"
                                            type="email"
                                            value={user.email}
                                            onChange={(e) => {
                                              const email = e.target.value;
                                              const error = validateEmail(email);
                                              if (error && email.trim()) {
                                                setValidationErrors({
                                                  ...validationErrors,
                                                  [`user-${index}-email`]: error,
                                                });
                                              } else {
                                                const newErrors = { ...validationErrors };
                                                delete newErrors[`user-${index}-email`];
                                                setValidationErrors(newErrors);
                                              }
                                              updateUser(index, { email });
                                            }}
                                            className={validationErrors[`user-${index}-email`] ? 'border-red-500' : ''}
                                          />
                                          {validationErrors[`user-${index}-email`] && (
                                            <p className="text-xs text-red-500">{validationErrors[`user-${index}-email`]}</p>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="first-name">First Name</Label>
                                          <Input
                                            id="first-name"
                                            value={user.firstName || ''}
                                            onChange={(e) => updateUser(index, { firstName: e.target.value })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="last-name">Last Name</Label>
                                          <Input
                                            id="last-name"
                                            value={user.lastName || ''}
                                            onChange={(e) => updateUser(index, { lastName: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={user.enabled ?? true}
                                            onCheckedChange={(checked) => updateUser(index, { enabled: checked })}
                                          />
                                          <Label>Enabled</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={user.emailVerified ?? false}
                                            onCheckedChange={(checked) => updateUser(index, { emailVerified: checked })}
                                          />
                                          <Label>Email Verified</Label>
                                        </div>
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="credentials" className="space-y-4 mt-4">
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="password">Password</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              id="password"
                                              type={showPassword[index] ? "text" : "password"}
                                              placeholder="Set new password"
                                              value={newPassword[index] || ''}
                                              onChange={(e) => setNewPassword({ ...newPassword, [index]: e.target.value })}
                                            />
                                            <Button 
                                              variant="outline"
                                              onClick={() => setShowPassword({ ...showPassword, [index]: !showPassword[index] })}
                                            >
                                              {showPassword[index] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              id="temporary-password"
                                              className="rounded"
                                              checked={temporaryPassword[index] || false}
                                              onChange={(e) => setTemporaryPassword({ ...temporaryPassword, [index]: e.target.checked })}
                                            />
                                            <Label htmlFor="temporary-password" className="text-sm font-normal">
                                              Temporary password (user must change on first login)
                                            </Label>
                                          </div>
                                          {(newPassword[index] || '').length > 0 && (
                                            <Button
                                              size="sm"
                                              onClick={() => {
                                                if (newPassword[index]) {
                                                  setUserPassword(index, newPassword[index], temporaryPassword[index] || false);
                                                }
                                              }}
                                            >
                                              Set Password
                                            </Button>
                                          )}
                                        </div>
                                        {user.credentials && user.credentials.length > 0 && (
                                          <div className="space-y-2">
                                            <Label>Existing Credentials</Label>
                                            {user.credentials.map((cred, i) => (
                                              <Card key={i} className="p-3">
                                                <div className="flex items-center justify-between">
                                                  <div>
                                                    <div className="font-medium">{cred.type}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                      {cred.temporary ? 'Temporary' : 'Permanent'}
                                                    </div>
                                                  </div>
                                                  <Button 
                                                    size="sm" 
                                                    variant="ghost"
                                                    onClick={() => removeUserCredential(index, i)}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </Card>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="role-mappings" className="space-y-4 mt-4">
                                      <div className="space-y-4">
                                        <div>
                                          <Label>Realm Roles</Label>
                                          <p className="text-xs text-muted-foreground mb-2">
                                            Assign realm-level roles to this user
                                          </p>
                                          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                            {realmRoles.map(role => (
                                              <div key={role} className="flex items-center justify-between">
                                                <span className="text-sm">{role}</span>
                                                <Switch
                                                  checked={user.roles.includes(role)}
                                                  onCheckedChange={(checked) => {
                                                    const newRoles = checked
                                                      ? [...user.roles, role]
                                                      : user.roles.filter(r => r !== role);
                                                    updateUser(index, { roles: newRoles });
                                                  }}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        {clients.length > 0 && (
                                          <div>
                                            <Label>Client Roles</Label>
                                            <p className="text-xs text-muted-foreground mb-2">
                                              Assign client-specific roles
                                            </p>
                                            {clients.map(client => (
                                              <Card key={client.id} className="p-3 mb-2">
                                                <div className="font-medium text-sm mb-2">{client.name}</div>
                                                {client.roles && client.roles.length > 0 ? (
                                                  <div className="space-y-1">
                                                    {client.roles.map(role => (
                                                      <div key={role} className="flex items-center justify-between text-sm">
                                                        <span>{role}</span>
                                                        <Switch
                                                          checked={false}
                                                          onCheckedChange={() => {}}
                                                        />
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="text-xs text-muted-foreground">No client roles defined</p>
                                                )}
                                              </Card>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="groups" className="space-y-4 mt-4">
                                      <div className="space-y-2">
                                        <Label>Groups</Label>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          Assign user to groups
                                        </p>
                                        {groups.length > 0 ? (
                                          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                            {groups.map(group => (
                                              <div key={group.id} className="flex items-center justify-between">
                                                <span className="text-sm">{group.path}</span>
                                                <Switch
                                                  checked={user.groups?.includes(group.id) ?? false}
                                                  onCheckedChange={(checked) => {
                                                    const newGroups = checked
                                                      ? [...(user.groups || []), group.id]
                                                      : (user.groups || []).filter(g => g !== group.id);
                                                    updateUser(index, { groups: newGroups });
                                                  }}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                                            No groups configured
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="attributes" className="space-y-4 mt-4">
                                      <div className="space-y-2">
                                        <Label>User Attributes</Label>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          Custom attributes for this user
                                        </p>
                                        {user.attributes && Object.keys(user.attributes).length > 0 ? (
                                          <div className="space-y-2">
                                            {Object.entries(user.attributes).map(([key, values]) => (
                                              <div key={key} className="flex items-center gap-2">
                                                <Input
                                                  value={key}
                                                  placeholder="Attribute key"
                                                  className="flex-1"
                                                  onChange={(e) => {
                                                    const newKey = e.target.value;
                                                    if (newKey !== key) {
                                                      updateUserAttribute(index, key, newKey, Array.isArray(values) ? values : [String(values)]);
                                                    }
                                                  }}
                                                />
                                                <Input
                                                  value={Array.isArray(values) ? values.join(', ') : String(values)}
                                                  placeholder="Attribute value(s)"
                                                  className="flex-1"
                                                  onChange={(e) => {
                                                    const newValues = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                                    updateUserAttribute(index, key, key, newValues);
                                                  }}
                                                />
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost"
                                                  onClick={() => removeUserAttribute(index, key)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
                                            No attributes configured
                                          </div>
                                        )}
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => addUserAttribute(index)}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add Attribute
                                        </Button>
                                      </div>
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {users.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeUser(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                      {userSearch ? 'No users found matching your search' : 'No users configured'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Flows Tab */}
          <TabsContent value="authentication" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Flows</CardTitle>
                <CardDescription>Configure authentication flows and execution steps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {authenticationFlows.map((flow, index) => (
                  <Card key={flow.id} className="border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{flow.alias}</CardTitle>
                          {flow.description && (
                            <CardDescription className="mt-1">{flow.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant={flow.builtIn ? "default" : "outline"}>
                          {flow.builtIn ? 'Built-in' : 'Custom'}
                        </Badge>
                      </div>
                    </CardHeader>
                    {flow.executions && flow.executions.length > 0 && (
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Execution Steps</Label>
                          {flow.executions.map((execution, execIndex) => (
                            <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{execution.requirement}</Badge>
                                <div>
                                  <div className="font-medium">{execution.displayName}</div>
                                  <div className="text-xs text-muted-foreground">{execution.providerId}</div>
                                </div>
                              </div>
                              {execution.configurable && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Configure Execution: {execution.displayName}</DialogTitle>
                                      <DialogDescription>
                                        Configure the execution step settings for {flow.alias} flow
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 mt-4">
                                      <div className="space-y-2">
                                        <Label>Requirement Level</Label>
                                        <Select
                                          value={execution.requirement}
                                          onValueChange={(value) => {
                                            const updatedFlows = [...authenticationFlows];
                                            const updatedExecutions = [...(updatedFlows[index].executions || [])];
                                            updatedExecutions[execIndex] = {
                                              ...execution,
                                              requirement: value as 'REQUIRED' | 'ALTERNATIVE' | 'DISABLED' | 'CONDITIONAL'
                                            };
                                            updatedFlows[index] = {
                                              ...updatedFlows[index],
                                              executions: updatedExecutions
                                            };
                                            updateConfig({ authenticationFlows: updatedFlows });
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="REQUIRED">Required</SelectItem>
                                            <SelectItem value="ALTERNATIVE">Alternative</SelectItem>
                                            <SelectItem value="DISABLED">Disabled</SelectItem>
                                            <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                          {execution.requirement === 'REQUIRED' && 'This step must be executed successfully'}
                                          {execution.requirement === 'ALTERNATIVE' && 'This step is an alternative option'}
                                          {execution.requirement === 'DISABLED' && 'This step is disabled'}
                                          {execution.requirement === 'CONDITIONAL' && 'This step is executed conditionally'}
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Display Name</Label>
                                        <Input value={execution.displayName} readOnly />
                                        <p className="text-xs text-muted-foreground">
                                          Display name cannot be changed
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Provider ID</Label>
                                        <Input value={execution.providerId} readOnly />
                                        <p className="text-xs text-muted-foreground">
                                          Provider ID cannot be changed
                                        </p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Identity Providers Tab */}
          <TabsContent value="identity-providers" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Identity Providers</CardTitle>
                    <CardDescription>Configure social logins, SAML, LDAP, and other identity providers</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Provider
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Identity Provider</DialogTitle>
                        <DialogDescription>
                          Select the type of identity provider to add
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <Button variant="outline" onClick={() => { addIdentityProvider('google'); }}>Google</Button>
                        <Button variant="outline" onClick={() => { addIdentityProvider('github'); }}>GitHub</Button>
                        <Button variant="outline" onClick={() => { addIdentityProvider('facebook'); }}>Facebook</Button>
                        <Button variant="outline" onClick={() => { addIdentityProvider('saml'); }}>SAML 2.0</Button>
                        <Button variant="outline" onClick={() => { addIdentityProvider('oidc'); }}>OpenID Connect</Button>
                        <Button variant="outline" onClick={() => { addIdentityProvider('ldap'); }}>LDAP</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {identityProviders.length > 0 ? (
                  <div className="space-y-3">
                    {identityProviders.map((provider, index) => (
                      <Card key={provider.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded bg-primary/10">
                                <Network className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{provider.displayName || provider.alias}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {provider.providerId} • {provider.enabled ? 'Enabled' : 'Disabled'}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={provider.enabled ? "default" : "secondary"}>
                                {provider.enabled ? 'Active' : 'Inactive'}
                              </Badge>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Identity Provider: {provider.displayName || provider.alias}</DialogTitle>
                                    <DialogDescription>
                                      Configure identity provider settings
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                      <Label>Display Name</Label>
                                      <Input
                                        value={provider.displayName || ''}
                                        onChange={(e) => updateIdentityProvider(index, { displayName: e.target.value })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Enabled</Label>
                                      <Switch
                                        checked={provider.enabled}
                                        onCheckedChange={(checked) => updateIdentityProvider(index, { enabled: checked })}
                                      />
                                    </div>
                                    {provider.providerId === 'ldap' && (
                                      <div className="space-y-2">
                                        <Label>LDAP Server URL</Label>
                                        <Input
                                          placeholder="ldap://ldap.example.com:389"
                                          value={provider.config?.ldapUrl || ''}
                                          onChange={(e) => updateIdentityProvider(index, {
                                            config: { ...provider.config, ldapUrl: e.target.value }
                                          })}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => removeIdentityProvider(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                    <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No identity providers configured</p>
                    <p className="text-xs mt-1">Add providers for Google, GitHub, SAML, LDAP, etc.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Scopes Tab */}
          <TabsContent value="client-scopes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Client Scopes</CardTitle>
                    <CardDescription>Configure default and optional client scopes</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={addClientScope}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Scope
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Default Client Scopes</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      These scopes are always included in tokens
                    </p>
                    <div className="space-y-2">
                      {clientScopes.filter(s => s.id === 'profile' || s.id === 'email').map(scope => (
                        <Card key={scope.id} className="p-3 border-border">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{scope.name}</div>
                              {scope.description && (
                                <div className="text-xs text-muted-foreground mt-1">{scope.description}</div>
                              )}
                            </div>
                            <Badge variant="default">Default</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-base font-semibold">Optional Client Scopes</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      These scopes can be requested by clients
                    </p>
                    <div className="space-y-2">
                      {clientScopes.filter(s => s.id !== 'profile' && s.id !== 'email').map(scope => (
                        <Card key={scope.id} className="p-3 border-border">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{scope.name}</div>
                              {scope.description && (
                                <div className="text-xs text-muted-foreground mt-1">{scope.description}</div>
                              )}
                            </div>
                            <Badge variant="outline">Optional</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Realm Roles</CardTitle>
                    <CardDescription>Manage realm-level roles and permissions</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={addRealmRole}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {realmRoles.map(role => (
                    <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="font-medium">{role}</div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Role: {role}</DialogTitle>
                              <DialogDescription>
                                Role configuration
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label>Role Name</Label>
                                <Input value={role} readOnly />
                                <p className="text-xs text-muted-foreground">
                                  Role name cannot be changed
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => removeRealmRole(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Management</CardTitle>
                <CardDescription>Configure SSO session timeouts and token lifespans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="access-token-lifespan">Access Token Lifespan</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="access-token-lifespan"
                        type="number"
                        min="60"
                        max="3600"
                        value={accessTokenLifespan}
                        onChange={(e) => updateConfig({ accessTokenLifespan: parseInt(e.target.value) || 300 })}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                    <p className="text-xs text-muted-foreground">How long access tokens are valid</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refresh-token-lifespan">Refresh Token Lifespan</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="refresh-token-lifespan"
                        type="number"
                        min="60"
                        max="86400"
                        value={refreshTokenLifespan}
                        onChange={(e) => updateConfig({ refreshTokenLifespan: parseInt(e.target.value) || 1800 })}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                    <p className="text-xs text-muted-foreground">How long refresh tokens are valid</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sso-session-idle">SSO Session Idle</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sso-session-idle"
                        type="number"
                        min="60"
                        max="7200"
                        value={ssoSessionIdle}
                        onChange={(e) => updateConfig({ ssoSessionIdle: parseInt(e.target.value) || 1800 })}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Idle timeout for SSO sessions</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sso-session-max">SSO Session Max</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="sso-session-max"
                        type="number"
                        min="300"
                        max="86400"
                        value={ssoSessionMax}
                        onChange={(e) => updateConfig({ ssoSessionMax: parseInt(e.target.value) || 36000 })}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Maximum SSO session duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>SSL/TLS, protocols, and password policies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SSL</Label>
                    <div className="text-sm text-muted-foreground">
                      Encrypt connections with TLS
                    </div>
                  </div>
                  <Switch
                    checked={enableSSL}
                    onCheckedChange={(checked) => updateConfig({ enableSSL: checked })}
                  />
                </div>
                {enableSSL && (
                  <div className="space-y-2">
                    <Label>SSL Required</Label>
                    <Select value={sslRequired} onValueChange={(value) => updateConfig({ sslRequired: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="external">External</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Separator />
                <div className="space-y-3">
                  <Label>Protocols</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <Label>OAuth2 / OpenID Connect</Label>
                      </div>
                      <Switch
                        checked={enableOAuth2}
                        onCheckedChange={(checked) => updateConfig({ enableOAuth2: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label>SAML 2.0</Label>
                      </div>
                      <Switch
                        checked={enableSAML}
                        onCheckedChange={(checked) => updateConfig({ enableSAML: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label>LDAP / Active Directory</Label>
                      </div>
                      <Switch
                        checked={enableLDAP}
                        onCheckedChange={(checked) => updateConfig({ enableLDAP: checked })}
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="password-policy">Password Policy</Label>
                  <Input
                    id="password-policy"
                    value={passwordPolicy}
                    onChange={(e) => updateConfig({ passwordPolicy: e.target.value })}
                    placeholder="length(8) and digits(1)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Keycloak password policy expression. Examples: length(8), digits(1), uppercase(1), lowercase(1), specialChars(1)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
