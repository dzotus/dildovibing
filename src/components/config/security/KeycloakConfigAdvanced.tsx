import { useCanvasStore } from '@/store/useCanvasStore';
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
  XCircle
} from 'lucide-react';

interface KeycloakConfigProps {
  componentId: string;
}

interface Client {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  protocol: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  roles: string[];
}

interface KeycloakConfig {
  realm?: string;
  adminUrl?: string;
  enableSSL?: boolean;
  sslRequired?: string;
  accessTokenLifespan?: number;
  ssoSessionIdle?: number;
  ssoSessionMax?: number;
  enableOAuth2?: boolean;
  enableSAML?: boolean;
  enableLDAP?: boolean;
  passwordPolicy?: string;
  clients?: Client[];
  users?: User[];
}

export function KeycloakConfigAdvanced({ componentId }: KeycloakConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KeycloakConfig;
  const realm = config.realm || 'archiphoenix';
  const adminUrl = config.adminUrl || 'http://keycloak:8080';
  const enableSSL = config.enableSSL ?? false;
  const sslRequired = config.sslRequired || 'external';
  const accessTokenLifespan = config.accessTokenLifespan || 300;
  const ssoSessionIdle = config.ssoSessionIdle || 1800;
  const ssoSessionMax = config.ssoSessionMax || 36000;
  const enableOAuth2 = config.enableOAuth2 ?? true;
  const enableSAML = config.enableSAML ?? false;
  const enableLDAP = config.enableLDAP ?? false;
  const passwordPolicy = config.passwordPolicy || 'length(8)';
  const clients = config.clients || [
    { id: 'archiphoenix-app', name: 'ArchiPhoenix App', type: 'public', enabled: true, protocol: 'openid-connect' },
    { id: 'admin-cli', name: 'Admin CLI', type: 'public', enabled: true, protocol: 'openid-connect' },
  ];
  const users = config.users || [
    { id: '1', username: 'admin', email: 'admin@archiphoenix.com', enabled: true, roles: ['admin', 'user'] },
    { id: '2', username: 'user1', email: 'user1@archiphoenix.com', enabled: true, roles: ['user'] },
  ];

  const updateConfig = (updates: Partial<KeycloakConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addClient = () => {
    updateConfig({
      clients: [...clients, { id: 'new-client', name: 'New Client', type: 'public', enabled: true, protocol: 'openid-connect' }],
    });
  };

  const removeClient = (index: number) => {
    updateConfig({ clients: clients.filter((_, i) => i !== index) });
  };

  const addUser = () => {
    updateConfig({
      users: [...users, { id: String(users.length + 1), username: 'newuser', email: 'newuser@example.com', enabled: true, roles: ['user'] }],
    });
  };

  const removeUser = (index: number) => {
    updateConfig({ users: users.filter((_, i) => i !== index) });
  };

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
                Identity and Access Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active
            </Badge>
            <Button size="sm" variant="outline">
              <Globe className="h-4 w-4 mr-2" />
              Admin Console
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Realm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realm}</div>
              <p className="text-xs text-muted-foreground mt-1">Current realm</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.enabled).length * 2}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="realm" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
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
                <CardTitle>Realm Configuration</CardTitle>
                <CardDescription>Keycloak realm and admin settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="realm">Realm Name</Label>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>OAuth2 and OpenID Connect clients</CardDescription>
                  </div>
                  <Button size="sm" onClick={addClient} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clients.map((client, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Key className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{client.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {client.id} • {client.type} • {client.protocol}
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>User accounts and roles</CardDescription>
                  </div>
                  <Button size="sm" onClick={addUser} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((user, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                      <div className="p-2 rounded-full bg-secondary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <div className="flex gap-1 mt-1">
                          {user.roles.map((role, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
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
              <CardContent className="space-y-4">
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
                        <Label>OAuth2</Label>
                      </div>
                      <Switch
                        checked={enableOAuth2}
                        onCheckedChange={(checked) => updateConfig({ enableOAuth2: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label>SAML</Label>
                      </div>
                      <Switch
                        checked={enableSAML}
                        onCheckedChange={(checked) => updateConfig({ enableSAML: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label>LDAP</Label>
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
                  <p className="text-xs text-muted-foreground">Keycloak password policy expression</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

