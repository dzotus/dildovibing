import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Users, Shield, Key, Settings, Globe } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Client {
  id: string;
  clientId: string;
  name: string;
  enabled: boolean;
  clientSecret?: string;
  redirectUris: string[];
  webOrigins: string[];
  protocol: 'openid-connect' | 'saml';
  publicClient: boolean;
  directAccessGrantsEnabled: boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface KeycloakConfig {
  serverUrl?: string;
  realm?: string;
  adminUsername?: string;
  adminPassword?: string;
  clients?: Client[];
  roles?: Role[];
  users?: User[];
  enableRegistration?: boolean;
  enableRememberMe?: boolean;
  sessionTimeout?: number;
  sslRequired?: 'none' | 'external' | 'all';
}

export function KeycloakConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('clients');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KeycloakConfig;
  const clients = config.clients || [];
  const roles = config.roles || [];
  const users = config.users || [];

  const updateConfig = (updates: Partial<KeycloakConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addClient = () => {
    const newClient: Client = {
      id: `client-${Date.now()}`,
      clientId: 'new-client',
      name: 'New Client',
      enabled: true,
      redirectUris: [],
      webOrigins: [],
      protocol: 'openid-connect',
      publicClient: false,
      directAccessGrantsEnabled: true,
    };
    updateConfig({ clients: [...clients, newClient] });
  };

  const updateClient = (index: number, updates: Partial<Client>) => {
    const updated = [...clients];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ clients: updated });
  };

  const removeClient = (index: number) => {
    updateConfig({ clients: clients.filter((_, i) => i !== index) });
  };

  const addRole = () => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: 'new-role',
      composite: false,
    };
    updateConfig({ roles: [...roles, newRole] });
  };

  const updateRole = (index: number, updates: Partial<Role>) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ roles: updated });
  };

  const removeRole = (index: number) => {
    updateConfig({ roles: roles.filter((_, i) => i !== index) });
  };

  const addUser = () => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      username: 'new-user',
      email: 'user@example.com',
      enabled: true,
      roles: [],
    };
    updateConfig({ users: [...users, newUser] });
  };

  const updateUser = (index: number, updates: Partial<User>) => {
    const updated = [...users];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ users: updated });
  };

  const removeUser = (index: number) => {
    updateConfig({ users: users.filter((_, i) => i !== index) });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Keycloak Identity Provider
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure realm, clients, roles, and users
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="clients" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">OAuth Clients</h3>
                  <p className="text-sm text-muted-foreground">Configure OAuth2 and OpenID Connect clients</p>
                </div>
                <Button onClick={addClient} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </div>

              <div className="space-y-4">
                {clients.map((client, index) => (
                  <div key={client.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        <Input
                          value={client.name}
                          onChange={(e) => updateClient(index, { name: e.target.value })}
                          placeholder="Client Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        <Badge variant={client.enabled ? 'default' : 'secondary'}>
                          {client.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeClient(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                          value={client.clientId}
                          onChange={(e) => updateClient(index, { clientId: e.target.value })}
                          placeholder="my-client"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Protocol</Label>
                        <select
                          value={client.protocol}
                          onChange={(e) =>
                            updateClient(index, { protocol: e.target.value as Client['protocol'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="openid-connect">OpenID Connect</option>
                          <option value="saml">SAML</option>
                        </select>
                      </div>
                    </div>

                    {!client.publicClient && (
                      <div className="space-y-2">
                        <Label>Client Secret</Label>
                        <Input
                          type="password"
                          value={client.clientSecret || ''}
                          onChange={(e) => updateClient(index, { clientSecret: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={client.enabled}
                          onCheckedChange={(checked) => updateClient(index, { enabled: checked })}
                        />
                        <Label className="text-sm">Enabled</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={client.publicClient}
                          onCheckedChange={(checked) => updateClient(index, { publicClient: checked })}
                        />
                        <Label className="text-sm">Public Client</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={client.directAccessGrantsEnabled}
                          onCheckedChange={(checked) =>
                            updateClient(index, { directAccessGrantsEnabled: checked })
                          }
                        />
                        <Label className="text-sm">Direct Access Grants</Label>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Valid Redirect URIs (one per line)</Label>
                      <textarea
                        value={client.redirectUris.join('\n')}
                        onChange={(e) =>
                          updateClient(index, {
                            redirectUris: e.target.value.split('\n').filter((uri) => uri.trim()),
                          })
                        }
                        placeholder="http://localhost:3000/callback&#10;https://app.example.com/callback"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Web Origins (one per line)</Label>
                      <textarea
                        value={client.webOrigins.join('\n')}
                        onChange={(e) =>
                          updateClient(index, {
                            webOrigins: e.target.value.split('\n').filter((origin) => origin.trim()),
                          })
                        }
                        placeholder="http://localhost:3000&#10;https://app.example.com"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}

                {clients.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No clients defined. Click "Add Client" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Roles</h3>
                  <p className="text-sm text-muted-foreground">Define roles for access control</p>
                </div>
                <Button onClick={addRole} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </div>

              <div className="space-y-4">
                {roles.map((role, index) => (
                  <div key={role.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        <Input
                          value={role.name}
                          onChange={(e) => updateRole(index, { name: e.target.value })}
                          placeholder="Role Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        {role.composite && <Badge variant="outline">Composite</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRole(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={role.description || ''}
                        onChange={(e) => updateRole(index, { description: e.target.value })}
                        placeholder="Role description"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={role.composite}
                        onCheckedChange={(checked) => updateRole(index, { composite: checked })}
                      />
                      <Label className="text-sm">Composite Role (can contain other roles)</Label>
                    </div>
                  </div>
                ))}

                {roles.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No roles defined. Click "Add Role" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Users</h3>
                  <p className="text-sm text-muted-foreground">Manage user accounts and their roles</p>
                </div>
                <Button onClick={addUser} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>

              <div className="space-y-4">
                {users.map((user, index) => (
                  <div key={user.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <Input
                          value={user.username}
                          onChange={(e) => updateUser(index, { username: e.target.value })}
                          placeholder="Username"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        <Badge variant={user.enabled ? 'default' : 'secondary'}>
                          {user.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUser(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={user.email}
                          onChange={(e) => updateUser(index, { email: e.target.value })}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={user.firstName || ''}
                          onChange={(e) => updateUser(index, { firstName: e.target.value })}
                          placeholder="John"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={user.lastName || ''}
                          onChange={(e) => updateUser(index, { lastName: e.target.value })}
                          placeholder="Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Roles</Label>
                        <select
                          multiple
                          value={user.roles}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                            updateUser(index, { roles: selected });
                          }}
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.name}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">Hold Ctrl/Cmd to select multiple roles</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.enabled}
                        onCheckedChange={(checked) => updateUser(index, { enabled: checked })}
                      />
                      <Label className="text-sm">User Enabled</Label>
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users defined. Click "Add User" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Realm Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Server URL</Label>
                      <Input
                        value={config.serverUrl || ''}
                        onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                        placeholder="http://localhost:8080"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Realm Name</Label>
                      <Input
                        value={config.realm || ''}
                        onChange={(e) => updateConfig({ realm: e.target.value })}
                        placeholder="master"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Admin Username</Label>
                      <Input
                        value={config.adminUsername || ''}
                        onChange={(e) => updateConfig({ adminUsername: e.target.value })}
                        placeholder="admin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Password</Label>
                      <Input
                        type="password"
                        value={config.adminPassword || ''}
                        onChange={(e) => updateConfig({ adminPassword: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enableRegistration || false}
                        onCheckedChange={(checked) => updateConfig({ enableRegistration: checked })}
                      />
                      <Label>Enable User Registration</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enableRememberMe !== false}
                        onCheckedChange={(checked) => updateConfig({ enableRememberMe: checked })}
                      />
                      <Label>Enable Remember Me</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={config.sessionTimeout || 1800}
                      onChange={(e) => updateConfig({ sessionTimeout: parseInt(e.target.value) || 1800 })}
                      placeholder="1800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>SSL Required</Label>
                    <select
                      value={config.sslRequired || 'external'}
                      onChange={(e) =>
                        updateConfig({ sslRequired: e.target.value as 'none' | 'external' | 'all' })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="external">External Only</option>
                      <option value="all">All Requests</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

