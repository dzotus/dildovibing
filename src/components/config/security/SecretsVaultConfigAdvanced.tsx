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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
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
  CheckCircle,
  Search,
  X
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
  const { componentMetrics, isRunning } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get real-time metrics from emulation engine
  const metrics = componentMetrics.get(componentId);
  const vaultEngine = emulationEngine.getVaultEmulationEngine(componentId);

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
  // Get real-time metrics from emulation
  const vaultMetrics = vaultEngine?.getMetrics();
  const vaultConfig = vaultEngine?.getConfig();
  
  // Use real metrics if available, otherwise fallback to config
  const totalSecrets = vaultMetrics?.secretsTotal ?? config.totalSecrets ?? secrets.length;
  const enginesEnabled = vaultConfig?.engines.filter((e) => e.enabled).length ?? config.enginesEnabled ?? engines.filter((e) => e.enabled).length;
  const activeTokens = vaultMetrics?.activeTokens ?? 0;
  const readOps = vaultMetrics?.readRequestsTotal ?? 0;
  const writeOps = vaultMetrics?.writeRequestsTotal ?? 0;
  const authOps = vaultMetrics?.authRequestsTotal ?? 0;
  const encryptionOps = vaultMetrics?.encryptionOperationsTotal ?? 0;
  const decryptionOps = vaultMetrics?.decryptionOperationsTotal ?? 0;

  // State declarations - must be before useMemo/useEffect that use them
  const [editingSecretIndex, setEditingSecretIndex] = useState<number | null>(null);
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [showCreateEngine, setShowCreateEngine] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newSecretForm, setNewSecretForm] = useState({ path: 'secret/', key: '', value: '' });
  const [newEngineForm, setNewEngineForm] = useState({ name: '', type: 'kv' as const, version: 2 });
  const [newPolicyForm, setNewPolicyForm] = useState({ name: '', rules: 'path "*" { capabilities = ["read"] }' });
  const [formErrors, setFormErrors] = useState<{
    secret?: { path?: string; key?: string; value?: string };
    engine?: { name?: string };
    policy?: { name?: string; rules?: string };
  }>({});

  // Filter secrets based on search query
  const filteredSecrets = useMemo(() => {
    if (!searchQuery) return secrets;
    const query = searchQuery.toLowerCase();
    return secrets.filter(
      (s) =>
        s.path.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query) ||
        s.value.toLowerCase().includes(query)
    );
  }, [secrets, searchQuery]);

  // Sync config with emulation engine when it changes
  useEffect(() => {
    if (vaultEngine && node) {
      vaultEngine.initializeConfig(node);
    }
  }, [config, node, vaultEngine]);

  const updateConfig = (updates: Partial<SecretsVaultConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const handleRefresh = () => {
    if (vaultEngine && node) {
      vaultEngine.initializeConfig(node);
      toast({
        title: 'Refreshed',
        description: 'Vault configuration refreshed from emulation engine',
      });
    }
  };

  const addSecret = () => {
    const errors: { path?: string; key?: string; value?: string } = {};
    if (!newSecretForm.path?.trim()) {
      errors.path = 'Path is required';
    }
    if (!newSecretForm.key?.trim()) {
      errors.key = 'Key is required';
    }
    if (!newSecretForm.value?.trim()) {
      errors.value = 'Value is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors({ ...formErrors, secret: errors });
      return;
    }

    setFormErrors({ ...formErrors, secret: undefined });
    const newSecret: Secret = {
      id: `secret-${Date.now()}`,
      path: newSecretForm.path,
      key: newSecretForm.key,
      value: newSecretForm.value,
      version: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      visible: false,
    };
    updateConfig({ secrets: [...secrets, newSecret] });
    setShowCreateSecret(false);
    setNewSecretForm({ path: 'secret/', key: '', value: '' });
    toast({
      title: 'Secret Created',
      description: `Secret ${newSecretForm.path}/${newSecretForm.key} created successfully`,
    });
  };

  const removeSecret = (id: string) => {
    const secret = secrets.find((s) => s.id === id);
    if (secret) {
      updateConfig({ secrets: secrets.filter((s) => s.id !== id) });
      toast({
        title: 'Secret Deleted',
        description: `Secret ${secret.path}/${secret.key} deleted`,
      });
    }
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
    const errors: { name?: string } = {};
    if (!newEngineForm.name?.trim()) {
      errors.name = 'Engine name is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors({ ...formErrors, engine: errors });
      return;
    }

    setFormErrors({ ...formErrors, engine: undefined });
    const newEngine: SecretEngine = {
      id: `engine-${Date.now()}`,
      name: newEngineForm.name,
      type: newEngineForm.type,
      enabled: true,
      version: newEngineForm.type === 'kv' ? newEngineForm.version : undefined,
    };
    updateConfig({ engines: [...engines, newEngine] });
    setShowCreateEngine(false);
    setNewEngineForm({ name: '', type: 'kv', version: 2 });
    toast({
      title: 'Engine Created',
      description: `Secret engine ${newEngineForm.name} created successfully`,
    });
  };

  const removeEngine = (id: string) => {
    const engine = engines.find((e) => e.id === id);
    if (engine) {
      updateConfig({ engines: engines.filter((e) => e.id !== id) });
      toast({
        title: 'Engine Removed',
        description: `Secret engine ${engine.name} removed`,
      });
    }
  };

  const updateEngine = (id: string, field: string, value: any) => {
    const newEngines = engines.map((e) =>
      e.id === id ? { ...e, [field]: value } : e
    );
    updateConfig({ engines: newEngines });
  };

  const addPolicy = () => {
    if (!newPolicyForm.name || !newPolicyForm.rules) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    const newPolicy: Policy = {
      id: `policy-${Date.now()}`,
      name: newPolicyForm.name,
      rules: newPolicyForm.rules,
      enabled: true,
    };
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
    setNewPolicyForm({ name: '', rules: 'path "*" { capabilities = ["read"] }' });
    toast({
      title: 'Policy Created',
      description: `Access policy ${newPolicyForm.name} created successfully`,
    });
  };

  const removePolicy = (id: string) => {
    const policy = policies.find((p) => p.id === id);
    if (policy) {
      updateConfig({ policies: policies.filter((p) => p.id !== id) });
      toast({
        title: 'Policy Deleted',
        description: `Access policy ${policy.name} deleted`,
      });
    }
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
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
              {metrics && (
                <p className="text-xs text-muted-foreground mt-1">
                  {readOps} reads, {writeOps} writes
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Engines Enabled</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{enginesEnabled}</span>
              {metrics && (
                <p className="text-xs text-muted-foreground mt-1">
                  {encryptionOps + decryptionOps} crypto ops
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{activeTokens}</span>
              {metrics && (
                <p className="text-xs text-muted-foreground mt-1">
                  {authOps} auth requests
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vault Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{vaultType}</Badge>
              {metrics && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Throughput:</span>
                    <span className="font-semibold">{Math.round(metrics.throughput)} ops/s</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="font-semibold">{Math.round(metrics.latency)} ms</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Error Rate:</span>
                    <span className="font-semibold">{(metrics.errorRate * 100).toFixed(2)}%</span>
                  </div>
                </div>
              )}
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
            <TabsTrigger value="tokens">
              <Lock className="h-4 w-4 mr-2" />
              Tokens ({activeTokens})
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Activity className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="secrets" className="space-y-4">
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Secrets</CardTitle>
                      <CardDescription>Manage stored secrets and credentials</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search secrets..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 w-64"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setSearchQuery('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <Button onClick={() => setShowCreateSecret(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Secret
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredSecrets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No secrets found matching your search' : 'No secrets configured'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredSecrets.map((secret) => (
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
                )}
              </CardContent>
            </Card>

            {/* Create Secret Dialog */}
            <Dialog open={showCreateSecret} onOpenChange={setShowCreateSecret}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Secret</DialogTitle>
                  <DialogDescription>
                    Add a new secret to the vault
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={newSecretForm.path}
                      onChange={(e) => {
                        setNewSecretForm({ ...newSecretForm, path: e.target.value });
                        if (formErrors.secret?.path) {
                          setFormErrors({ ...formErrors, secret: { ...formErrors.secret, path: undefined } });
                        }
                      }}
                      placeholder="secret/app/database"
                      className={formErrors.secret?.path ? 'border-destructive' : ''}
                    />
                    {formErrors.secret?.path && (
                      <p className="text-sm text-destructive">{formErrors.secret.path}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Key</Label>
                    <Input
                      value={newSecretForm.key}
                      onChange={(e) => {
                        setNewSecretForm({ ...newSecretForm, key: e.target.value });
                        if (formErrors.secret?.key) {
                          setFormErrors({ ...formErrors, secret: { ...formErrors.secret, key: undefined } });
                        }
                      }}
                      placeholder="password"
                      className={formErrors.secret?.key ? 'border-destructive' : ''}
                    />
                    {formErrors.secret?.key && (
                      <p className="text-sm text-destructive">{formErrors.secret.key}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      type="password"
                      value={newSecretForm.value}
                      onChange={(e) => {
                        setNewSecretForm({ ...newSecretForm, value: e.target.value });
                        if (formErrors.secret?.value) {
                          setFormErrors({ ...formErrors, secret: { ...formErrors.secret, value: undefined } });
                        }
                      }}
                      placeholder="Enter secret value"
                      className={formErrors.secret?.value ? 'border-destructive' : ''}
                    />
                    {formErrors.secret?.value && (
                      <p className="text-sm text-destructive">{formErrors.secret.value}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowCreateSecret(false);
                    setFormErrors({ ...formErrors, secret: undefined });
                    setNewSecretForm({ path: 'secret/', key: '', value: '' });
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={addSecret}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          </TabsContent>

          <TabsContent value="engines" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Secret Engines</CardTitle>
                    <CardDescription>Configure secret storage engines</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateEngine(true)} size="sm">
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

            {/* Create Engine Dialog */}
            <Dialog open={showCreateEngine} onOpenChange={setShowCreateEngine}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enable Secret Engine</DialogTitle>
                  <DialogDescription>
                    Configure a new secret storage engine
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Engine Name</Label>
                    <Input
                      value={newEngineForm.name}
                      onChange={(e) => {
                        setNewEngineForm({ ...newEngineForm, name: e.target.value });
                        if (formErrors.engine?.name) {
                          setFormErrors({ ...formErrors, engine: { name: undefined } });
                        }
                      }}
                      placeholder="secret/"
                      className={formErrors.engine?.name ? 'border-destructive' : ''}
                    />
                    {formErrors.engine?.name && (
                      <p className="text-sm text-destructive">{formErrors.engine.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Engine Type</Label>
                    <Select
                      value={newEngineForm.type}
                      onValueChange={(value: 'kv' | 'transit' | 'pki' | 'database' | 'aws' | 'azure') =>
                        setNewEngineForm({ ...newEngineForm, type: value })
                      }
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
                  {newEngineForm.type === 'kv' && (
                    <div className="space-y-2">
                      <Label>KV Version</Label>
                      <Select
                        value={newEngineForm.version.toString()}
                        onValueChange={(value) => setNewEngineForm({ ...newEngineForm, version: Number(value) })}
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
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowCreateEngine(false);
                    setFormErrors({ ...formErrors, engine: undefined });
                    setNewEngineForm({ name: '', type: 'kv', version: 2 });
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={addEngine}>Enable</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Policies</CardTitle>
                    <CardDescription>Configure access control policies</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreatePolicy(true)} size="sm">
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

            {/* Create Policy Dialog */}
            <Dialog open={showCreatePolicy} onOpenChange={setShowCreatePolicy}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Access Policy</DialogTitle>
                  <DialogDescription>
                    Define access control rules using HCL syntax
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Policy Name</Label>
                    <Input
                      value={newPolicyForm.name}
                      onChange={(e) => {
                        setNewPolicyForm({ ...newPolicyForm, name: e.target.value });
                        if (formErrors.policy?.name) {
                          setFormErrors({ ...formErrors, policy: { ...formErrors.policy, name: undefined } });
                        }
                      }}
                      placeholder="readonly"
                      className={formErrors.policy?.name ? 'border-destructive' : ''}
                    />
                    {formErrors.policy?.name && (
                      <p className="text-sm text-destructive">{formErrors.policy.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Rules (HCL)</Label>
                    <Textarea
                      value={newPolicyForm.rules}
                      onChange={(e) => {
                        setNewPolicyForm({ ...newPolicyForm, rules: e.target.value });
                        if (formErrors.policy?.rules) {
                          setFormErrors({ ...formErrors, policy: { ...formErrors.policy, rules: undefined } });
                        }
                      }}
                      rows={8}
                      className={`font-mono text-sm ${formErrors.policy?.rules ? 'border-destructive' : ''}`}
                      placeholder='path "*" { capabilities = ["read", "list"] }'
                    />
                    {formErrors.policy?.rules && (
                      <p className="text-sm text-destructive">{formErrors.policy.rules}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowCreatePolicy(false);
                    setFormErrors({ ...formErrors, policy: undefined });
                    setNewPolicyForm({ name: '', rules: 'path "*" { capabilities = ["read"] }' });
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={addPolicy}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Active Tokens</CardTitle>
                    <CardDescription>Manage authentication tokens</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {vaultEngine ? (
                  <div className="space-y-4">
                    {vaultEngine.getActiveTokens().length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No active tokens
                      </div>
                    ) : (
                      vaultEngine.getActiveTokens().map((token) => (
                        <Card key={token.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base font-mono text-sm">{token.token.substring(0, 20)}...</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{token.policies.length} policies</Badge>
                                  <Badge variant={token.renewable ? 'default' : 'outline'}>
                                    {token.renewable ? 'Renewable' : 'Non-renewable'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Created:</span>
                                <span className="ml-2">{new Date(token.createdAt).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Expires:</span>
                                <span className="ml-2">{new Date(token.expiresAt).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">TTL:</span>
                                <span className="ml-2">{Math.floor((token.expiresAt - Date.now()) / 1000 / 60)} minutes</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Policies:</span>
                                <span className="ml-2">{token.policies.join(', ')}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Vault engine not initialized
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>View operation history and audit trail</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {vaultMetrics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Read Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.readRequestsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Write Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.writeRequestsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Delete Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.deleteRequestsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Auth Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.authRequestsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Encryption Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.encryptionOperationsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Decryption Operations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.decryptionOperationsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Auth Errors</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold text-destructive">{vaultMetrics.authErrorsTotal}</span>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Tokens Issued</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-bold">{vaultMetrics.tokenIssuedTotal}</span>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit data available
                  </div>
                )}
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

