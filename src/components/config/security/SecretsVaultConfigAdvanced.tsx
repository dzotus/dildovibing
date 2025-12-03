import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Key,
  Lock,
  Database,
  Shield,
  Eye,
  EyeOff,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface SecretsVaultConfigProps {
  componentId: string;
}

interface Secret {
  id: string;
  path: string;
  key: string;
  value: string;
  version?: number;
  created?: string;
  updated?: string;
  visible?: boolean;
}

interface SecretEngine {
  id: string;
  name: string;
  type: 'kv' | 'transit' | 'pki' | 'database' | 'aws' | 'azure';
  enabled: boolean;
  version?: number;
  description?: string;
}

interface Policy {
  id: string;
  name: string;
  rules: string;
  enabled: boolean;
}

interface SecretsVaultConfig {
  vaultType?: 'hashicorp' | 'aws' | 'azure';
  address?: string;
  enableTLS?: boolean;
  enableTransit?: boolean;
  enableKV?: boolean;
  kvVersion?: string;
  enablePKI?: boolean;
  enableAuth?: boolean;
  authMethod?: 'token' | 'approle' | 'ldap' | 'aws';
  tokenTTL?: string;
  secrets?: Secret[];
  engines?: SecretEngine[];
  policies?: Policy[];
  totalSecrets?: number;
  enginesEnabled?: number;
}

export function SecretsVaultConfigAdvanced({ componentId }: SecretsVaultConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as SecretsVaultConfig;
  const vaultType = config.vaultType || 'hashicorp';
  const address = config.address || 'http://vault:8200';
  const enableTLS = config.enableTLS ?? false;
  const enableTransit = config.enableTransit ?? true;
  const enableKV = config.enableKV ?? true;
  const kvVersion = config.kvVersion || '2';
  const enablePKI = config.enablePKI ?? false;
  const enableAuth = config.enableAuth ?? true;
  const authMethod = config.authMethod || 'token';
  const tokenTTL = config.tokenTTL || '24h';
  const secrets = config.secrets || [
    {
      id: '1',
      path: 'secret/app/database',
      key: 'password',
      value: '••••••••',
      version: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      visible: false,
    },
    {
      id: '2',
      path: 'secret/app/api',
      key: 'api-key',
      value: '••••••••',
      version: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      visible: false,
    },
  ];
  const engines = config.engines || [
    { id: '1', name: 'secret/', type: 'kv', enabled: true, version: 2, description: 'Key-Value secrets' },
    { id: '2', name: 'transit/', type: 'transit', enabled: true, description: 'Encryption as a service' },
  ];
  const policies = config.policies || [
    {
      id: '1',
      name: 'admin',
      rules: 'path "*" { capabilities = ["create", "read", "update", "delete", "list"] }',
      enabled: true,
    },
    {
      id: '2',
      name: 'readonly',
      rules: 'path "*" { capabilities = ["read", "list"] }',
      enabled: true,
    },
  ];
  const totalSecrets = config.totalSecrets || secrets.length;
  const enginesEnabled = config.enginesEnabled || engines.filter((e) => e.enabled).length;

  const [editingSecretIndex, setEditingSecretIndex] = useState<number | null>(null);
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [showCreateEngine, setShowCreateEngine] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);

  const updateConfig = (updates: Partial<SecretsVaultConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addSecret = () => {
    const newSecret: Secret = {
      id: `secret-${Date.now()}`,
      path: 'secret/new',
      key: 'new-key',
      value: '',
      version: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      visible: false,
    };
    updateConfig({ secrets: [...secrets, newSecret] });
    setShowCreateSecret(false);
  };

  const removeSecret = (id: string) => {
    updateConfig({ secrets: secrets.filter((s) => s.id !== id) });
  };

  const updateSecret = (id: string, field: string, value: any) => {
    const newSecrets = secrets.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ secrets: newSecrets });
  };

  const toggleSecretVisibility = (id: string) => {
    const secret = secrets.find((s) => s.id === id);
    if (secret) {
      updateSecret(id, 'visible', !secret.visible);
    }
  };

  const copySecretValue = (id: string) => {
    const secret = secrets.find((s) => s.id === id);
    if (secret) {
      navigator.clipboard.writeText(secret.value);
      setCopiedSecretId(id);
      setTimeout(() => setCopiedSecretId(null), 2000);
    }
  };

  const addEngine = () => {
    const newEngine: SecretEngine = {
      id: `engine-${Date.now()}`,
      name: 'new-engine/',
      type: 'kv',
      enabled: true,
      version: 2,
    };
    updateConfig({ engines: [...engines, newEngine] });
    setShowCreateEngine(false);
  };

  const removeEngine = (id: string) => {
    updateConfig({ engines: engines.filter((e) => e.id !== id) });
  };

  const updateEngine = (id: string, field: string, value: any) => {
    const newEngines = engines.map((e) =>
      e.id === id ? { ...e, [field]: value } : e
    );
    updateConfig({ engines: newEngines });
  };

  const addPolicy = () => {
    const newPolicy: Policy = {
      id: `policy-${Date.now()}`,
      name: 'new-policy',
      rules: 'path "*" { capabilities = ["read"] }',
      enabled: true,
    };
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removePolicy = (id: string) => {
    updateConfig({ policies: policies.filter((p) => p.id !== id) });
  };

  const updatePolicy = (id: string, field: string, value: any) => {
    const newPolicies = policies.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateConfig({ policies: newPolicies });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Secrets Vault</p>
            <h2 className="text-2xl font-bold text-foreground">Vault Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Secure storage and management of secrets, API keys, and credentials
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Secrets</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalSecrets}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Engines Enabled</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{enginesEnabled}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{policies.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vault Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{vaultType}</Badge>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="secrets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="secrets">
              <Key className="h-4 w-4 mr-2" />
              Secrets ({secrets.length})
            </TabsTrigger>
            <TabsTrigger value="engines">
              <Database className="h-4 w-4 mr-2" />
              Secret Engines ({engines.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              Policies ({policies.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="secrets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Secrets</CardTitle>
                    <CardDescription>Manage stored secrets and credentials</CardDescription>
                  </div>
                  <Button onClick={addSecret} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Secret
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {secrets.map((secret) => (
                    <Card key={secret.id} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{secret.path}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{secret.key}</Badge>
                              <Badge variant="outline">v{secret.version}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleSecretVisibility(secret.id)}
                            >
                              {secret.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copySecretValue(secret.id)}
                            >
                              {copiedSecretId === secret.id ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSecret(secret.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={secret.path}
                              onChange={(e) => updateSecret(secret.id, 'path', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Key</Label>
                            <Input
                              value={secret.key}
                              onChange={(e) => updateSecret(secret.id, 'key', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Value</Label>
                            <Input
                              type={secret.visible ? 'text' : 'password'}
                              value={secret.value}
                              onChange={(e) => updateSecret(secret.id, 'value', e.target.value)}
                              placeholder="Enter secret value"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engines" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Secret Engines</CardTitle>
                    <CardDescription>Configure secret storage engines</CardDescription>
                  </div>
                  <Button onClick={addEngine} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Enable Engine
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {engines.map((engine) => (
                    <Card key={engine.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{engine.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={engine.enabled ? 'default' : 'outline'}>
                                {engine.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              <Badge variant="outline">{engine.type}</Badge>
                              {engine.version && (
                                <Badge variant="outline">v{engine.version}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={engine.enabled}
                              onCheckedChange={(checked) => updateEngine(engine.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEngine(engine.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Engine Name</Label>
                            <Input
                              value={engine.name}
                              onChange={(e) => updateEngine(engine.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Engine Type</Label>
                            <Select
                              value={engine.type}
                              onValueChange={(value: 'kv' | 'transit' | 'pki' | 'database' | 'aws' | 'azure') => updateEngine(engine.id, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kv">Key-Value (KV)</SelectItem>
                                <SelectItem value="transit">Transit</SelectItem>
                                <SelectItem value="pki">PKI</SelectItem>
                                <SelectItem value="database">Database</SelectItem>
                                <SelectItem value="aws">AWS</SelectItem>
                                <SelectItem value="azure">Azure</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {engine.type === 'kv' && (
                            <div className="space-y-2">
                              <Label>KV Version</Label>
                              <Select
                                value={engine.version?.toString() || '2'}
                                onValueChange={(value) => updateEngine(engine.id, 'version', Number(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Version 1</SelectItem>
                                  <SelectItem value="2">Version 2</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Policies</CardTitle>
                    <CardDescription>Configure access control policies</CardDescription>
                  </div>
                  <Button onClick={addPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <Card key={policy.id} className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{policy.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={policy.enabled ? 'default' : 'outline'}>
                                {policy.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={policy.enabled}
                              onCheckedChange={(checked) => updatePolicy(policy.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePolicy(policy.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Policy Name</Label>
                          <Input
                            value={policy.name}
                            onChange={(e) => updatePolicy(policy.id, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Policy Rules (HCL)</Label>
                          <Textarea
                            value={policy.rules}
                            onChange={(e) => updatePolicy(policy.id, 'rules', e.target.value)}
                            rows={6}
                            className="font-mono text-sm"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vault Settings</CardTitle>
                <CardDescription>General vault configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Vault Type</Label>
                  <Select
                    value={vaultType}
                    onValueChange={(value: 'hashicorp' | 'aws' | 'azure') => updateConfig({ vaultType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hashicorp">HashiCorp Vault</SelectItem>
                      <SelectItem value="aws">AWS Secrets Manager</SelectItem>
                      <SelectItem value="azure">Azure Key Vault</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vault Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => updateConfig({ address: e.target.value })}
                    placeholder="http://vault:8200"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable TLS</Label>
                  <Switch
                    checked={enableTLS}
                    onCheckedChange={(checked) => updateConfig({ enableTLS: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable KV Store</Label>
                    <Switch
                      checked={enableKV}
                      onCheckedChange={(checked) => updateConfig({ enableKV: checked })}
                    />
                  </div>
                  {enableKV && (
                    <div className="space-y-2">
                      <Label>KV Version</Label>
                      <Select
                        value={kvVersion}
                        onValueChange={(value) => updateConfig({ kvVersion: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Version 1</SelectItem>
                          <SelectItem value="2">Version 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label>Enable Transit</Label>
                    <Switch
                      checked={enableTransit}
                      onCheckedChange={(checked) => updateConfig({ enableTransit: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Enable PKI</Label>
                    <Switch
                      checked={enablePKI}
                      onCheckedChange={(checked) => updateConfig({ enablePKI: checked })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Authentication</Label>
                  <Switch
                    checked={enableAuth}
                    onCheckedChange={(checked) => updateConfig({ enableAuth: checked })}
                  />
                </div>
                {enableAuth && (
                  <div className="space-y-2">
                    <Label>Auth Method</Label>
                    <Select
                      value={authMethod}
                      onValueChange={(value: 'token' | 'approle' | 'ldap' | 'aws') => updateConfig({ authMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="token">Token</SelectItem>
                        <SelectItem value="approle">AppRole</SelectItem>
                        <SelectItem value="ldap">LDAP</SelectItem>
                        <SelectItem value="aws">AWS</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="space-y-2">
                      <Label>Token TTL</Label>
                      <Input
                        value={tokenTTL}
                        onChange={(e) => updateConfig({ tokenTTL: e.target.value })}
                        placeholder="24h"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

