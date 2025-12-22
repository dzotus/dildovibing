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
  AlertTriangle,
  Users,
  Bell,
  Clock,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { emulationEngine } from '@/core/EmulationEngine';

interface PagerDutyConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  integrationKey: string;
  status: 'active' | 'maintenance' | 'disabled';
  escalationPolicy?: string;
  autoResolve?: boolean;
  resolveTimeout?: number;
  incidentCount?: number;
}

interface Incident {
  id: string;
  title: string;
  service: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  severity: 'critical' | 'error' | 'warning' | 'info';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
}

interface EscalationPolicy {
  id: string;
  name: string;
  levels: Array<{
    level: number;
    timeout: number;
    targets: string[];
  }>;
}

interface PagerDutyConfig {
  services?: Service[];
  incidents?: Incident[];
  escalationPolicies?: EscalationPolicy[];
  onCallUsers?: Array<{
    id: string;
    name: string;
    email: string;
    status: 'on-call' | 'off-call';
  }>;
  totalIncidents?: number;
  activeIncidents?: number;
  resolvedIncidents?: number;
  // Global settings (aligned with profiles.ts and PagerDutyEmulationEngine)
  enableAutoResolve?: boolean;
  resolveTimeout?: number;
  enableWebhooks?: boolean;
  webhookUrl?: string;
  severityMapping?: 'standard' | 'error-focused' | 'warning-demoted';
}

export function PagerDutyConfigAdvanced({ componentId }: PagerDutyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PagerDutyConfig;
  const globalEnableAutoResolve = config.enableAutoResolve ?? true;
  const globalResolveTimeout = config.resolveTimeout ?? 300;
  const globalEnableWebhooks = config.enableWebhooks ?? false;
  const globalWebhookUrl = config.webhookUrl ?? '';
  const globalSeverityMapping = config.severityMapping ?? 'standard';
  const services = config.services || [
    {
      id: '1',
      name: 'archiphoenix-service',
      integrationKey: 'integration-key-123',
      status: 'active',
      escalationPolicy: 'default-policy',
      autoResolve: true,
      resolveTimeout: 300,
      incidentCount: 0,
    },
  ];
  const pagerDutyIncidents = emulationEngine.getPagerDutyIncidents(componentId);
  const incidents: Incident[] = pagerDutyIncidents.map((i) => {
    const service = services.find((s) => s.id === i.serviceId);
    return {
      id: i.id,
      title: i.title,
      service: service?.name || i.serviceId,
      status: i.status,
      severity: i.severity,
      createdAt: new Date(i.createdAt).toISOString(),
      acknowledgedAt: i.acknowledgedAt
        ? new Date(i.acknowledgedAt).toISOString()
        : undefined,
      resolvedAt: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : undefined,
    };
  });
  const escalationPolicies = config.escalationPolicies || [
    {
      id: '1',
      name: 'default-policy',
      levels: [
        { level: 1, timeout: 5, targets: ['user1'] },
        { level: 2, timeout: 15, targets: ['user2'] },
      ],
    },
  ];
  const onCallUsers = config.onCallUsers || [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'on-call' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'off-call' },
  ];
  const pagerDutyMetrics = emulationEngine.getPagerDutyMetrics(componentId);
  const totalIncidents = pagerDutyMetrics?.incidentsTotal ?? incidents.length;
  const activeIncidents = pagerDutyMetrics?.incidentsActive ?? incidents.filter((i) => i.status !== 'resolved').length;
  const resolvedIncidents = pagerDutyMetrics?.incidentsResolved ?? incidents.filter((i) => i.status === 'resolved').length;

  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [showCreateOnCall, setShowCreateOnCall] = useState(false);

  const updateConfig = (updates: Partial<PagerDutyConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addService = () => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      name: 'new-service',
      integrationKey: '',
      status: 'active',
      autoResolve: true,
      resolveTimeout: 300,
      incidentCount: 0,
    };
    updateConfig({ services: [...services, newService] });
    setShowCreateService(false);
  };

  const removeService = (id: string) => {
    updateConfig({ services: services.filter((s) => s.id !== id) });
  };

  const updateService = (id: string, field: string, value: any) => {
    const newServices = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ services: newServices });
  };

  const acknowledgeIncident = (id: string) => {
    emulationEngine.acknowledgePagerDutyIncident(componentId, id);
  };

  const resolveIncident = (id: string) => {
    emulationEngine.resolvePagerDutyIncident(componentId, id);
  };

  const addEscalationPolicy = () => {
    const newPolicy: EscalationPolicy = {
      id: `policy-${Date.now()}`,
      name: 'new-policy',
      levels: [{ level: 1, timeout: 5, targets: [] }],
    };
    updateConfig({ escalationPolicies: [...escalationPolicies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removeEscalationPolicy = (id: string) => {
    updateConfig({ escalationPolicies: escalationPolicies.filter((p) => p.id !== id) });
  };

  const updateEscalationPolicyName = (id: string, name: string) => {
    const updated = escalationPolicies.map((p) =>
      p.id === id ? { ...p, name } : p
    );
    updateConfig({ escalationPolicies: updated });
  };

  const addEscalationLevel = (policyId: string) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const nextLevel = (p.levels[p.levels.length - 1]?.level || 0) + 1;
      return {
        ...p,
        levels: [
          ...p.levels,
          { level: nextLevel, timeout: 5, targets: [] },
        ],
      };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const removeEscalationLevel = (policyId: string, levelIndex: number) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.filter((_, idx) => idx !== levelIndex);
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const updateEscalationLevelTimeout = (policyId: string, levelIndex: number, timeout: number) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.map((lvl, idx) =>
        idx === levelIndex ? { ...lvl, timeout } : lvl
      );
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const toggleEscalationLevelTarget = (policyId: string, levelIndex: number, userId: string) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.map((lvl, idx) => {
        if (idx !== levelIndex) return lvl;
        const has = lvl.targets.includes(userId);
        const targets = has
          ? lvl.targets.filter((t) => t !== userId)
          : [...lvl.targets, userId];
        return { ...lvl, targets };
      });
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const addOnCallUser = () => {
    const newUser = {
      id: `user-${Date.now()}`,
      name: 'On-Call User',
      email: 'user@example.com',
      status: 'on-call' as const,
    };
    updateConfig({ onCallUsers: [...onCallUsers, newUser] });
    setShowCreateOnCall(false);
  };

  const removeOnCallUser = (id: string) => {
    const updatedUsers = onCallUsers.filter((u) => u.id !== id);

    // Также очищаем targets в политиках, чтобы не висели "мертвые" ссылки
    const updatedPolicies = escalationPolicies.map((p) => ({
      ...p,
      levels: p.levels.map((lvl) => ({
        ...lvl,
        targets: lvl.targets.filter((t) => t !== id),
      })),
    }));

    updateConfig({
      onCallUsers: updatedUsers,
      escalationPolicies: updatedPolicies,
    });
  };

  const updateOnCallUser = (id: string, field: 'name' | 'email' | 'status', value: string) => {
    const updatedUsers = onCallUsers.map((u) =>
      u.id === id ? { ...u, [field]: value } : u
    );
    updateConfig({ onCallUsers: updatedUsers });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">PagerDuty</p>
            <h2 className="text-2xl font-bold text-foreground">Incident Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage incidents, services, escalation policies and on-call schedules
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
              <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-500">{activeIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-500">{resolvedIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Services</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{services.length}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Global Settings
            </CardTitle>
            <CardDescription>
              Control how incidents are auto-resolved, mapped by severity and propagated via webhooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Auto Resolve</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm text-muted-foreground">Enable automatic incident resolution</span>
                  <Switch
                    checked={globalEnableAutoResolve}
                    onCheckedChange={(checked) =>
                      updateConfig({ enableAutoResolve: checked })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resolve Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={globalResolveTimeout}
                  onChange={(e) =>
                    updateConfig({ resolveTimeout: Number(e.target.value) || 0 })
                  }
                  min={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Severity Mapping</Label>
                <Select
                  value={globalSeverityMapping}
                  onValueChange={(value: 'standard' | 'error-focused' | 'warning-demoted') =>
                    updateConfig({ severityMapping: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (critical / warning / info)</SelectItem>
                    <SelectItem value="error-focused">Error-focused (warnings treated as errors)</SelectItem>
                    <SelectItem value="warning-demoted">Warning demoted (warnings as info)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enable Webhooks</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm text-muted-foreground">Send outbound incident webhooks</span>
                  <Switch
                    checked={globalEnableWebhooks}
                    onCheckedChange={(checked) =>
                      updateConfig({ enableWebhooks: checked })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Webhook URL</Label>
                <Input
                  value={globalWebhookUrl}
                  onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                  placeholder="https://webhook.example.com/pagerduty"
                  disabled={!globalEnableWebhooks}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incidents">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Incidents ({activeIncidents})
            </TabsTrigger>
            <TabsTrigger value="services">
              <Settings className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Users className="h-4 w-4 mr-2" />
              Escalation Policies ({escalationPolicies.length})
            </TabsTrigger>
            <TabsTrigger value="oncall">
              <Bell className="h-4 w-4 mr-2" />
              On-Call
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Incidents</CardTitle>
                <CardDescription>Manage and respond to incidents</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No incidents</p>
                ) : (
                  <div className="space-y-2">
                    {incidents.map((incident) => (
                      <Card
                        key={incident.id}
                        className={`border-l-4 ${
                          incident.severity === 'critical' ? 'border-l-red-500' :
                          incident.severity === 'error' ? 'border-l-orange-500' :
                          incident.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  incident.status === 'resolved' ? 'default' :
                                  incident.status === 'acknowledged' ? 'secondary' : 'destructive'
                                }>
                                  {incident.status}
                                </Badge>
                                <Badge variant={
                                  incident.severity === 'critical' ? 'destructive' :
                                  incident.severity === 'error' ? 'default' : 'outline'
                                }>
                                  {incident.severity}
                                </Badge>
                                <span className="font-medium">{incident.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Service: {incident.service}</p>
                                <p>Created: {new Date(incident.createdAt).toLocaleString()}</p>
                                {incident.assignedTo && (
                                  <p>Assigned to: {incident.assignedTo}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {incident.status === 'triggered' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acknowledgeIncident(incident.id)}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {incident.status !== 'resolved' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => resolveIncident(incident.id)}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Configure monitored services</CardDescription>
                  </div>
                  <Button onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <Card key={service.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{service.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={
                                service.status === 'active' ? 'default' :
                                service.status === 'maintenance' ? 'secondary' : 'outline'
                              }>
                                {service.status}
                              </Badge>
                              <Badge variant="outline">
                                {service.incidentCount || 0} incidents
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                            disabled={services.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Service Name</Label>
                            <Input
                              value={service.name}
                              onChange={(e) => updateService(service.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Integration Key</Label>
                            <Input
                              value={service.integrationKey}
                              onChange={(e) => updateService(service.id, 'integrationKey', e.target.value)}
                              placeholder="integration-key"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={service.status}
                              onValueChange={(value: 'active' | 'maintenance' | 'disabled') => updateService(service.id, 'status', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="disabled">Disabled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Escalation Policy</Label>
                            <Select
                              value={service.escalationPolicy || ''}
                              onValueChange={(value) => updateService(service.id, 'escalationPolicy', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {escalationPolicies.map((p) => (
                                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Auto Resolve</Label>
                            <Switch
                              checked={service.autoResolve ?? true}
                              onCheckedChange={(checked) => updateService(service.id, 'autoResolve', checked)}
                            />
                          </div>
                          {service.autoResolve && (
                            <div className="space-y-2">
                              <Label>Resolve Timeout (seconds)</Label>
                              <Input
                                type="number"
                                value={service.resolveTimeout || 300}
                                onChange={(e) => updateService(service.id, 'resolveTimeout', Number(e.target.value))}
                                min={60}
                              />
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
                    <CardTitle>Escalation Policies</CardTitle>
                    <CardDescription>Configure incident escalation rules</CardDescription>
                  </div>
                  <Button onClick={addEscalationPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {escalationPolicies.map((policy) => (
                    <Card key={policy.id} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <Label>Policy Name</Label>
                            <Input
                              value={policy.name}
                              onChange={(e) => updateEscalationPolicyName(policy.id, e.target.value)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEscalationPolicy(policy.id)}
                            disabled={escalationPolicies.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{policy.levels.length} levels</span>
                          </div>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => addEscalationLevel(policy.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Level
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {policy.levels.map((level, lIndex) => (
                            <Card key={lIndex} className="p-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium">Level {level.level}</p>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeEscalationLevel(policy.id, lIndex)}
                                      disabled={policy.levels.length === 1}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Timeout (minutes)</Label>
                                      <Input
                                        type="number"
                                        value={level.timeout}
                                        min={1}
                                        onChange={(e) =>
                                          updateEscalationLevelTimeout(
                                            policy.id,
                                            lIndex,
                                            Number(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-xs">Targets (on-call users)</Label>
                                      <div className="flex flex-wrap gap-1">
                                        {onCallUsers.map((user) => {
                                          const selected = level.targets.includes(user.id);
                                          return (
                                            <Badge
                                              key={user.id}
                                              variant={selected ? 'default' : 'outline'}
                                              className="cursor-pointer text-xs"
                                              onClick={() =>
                                                toggleEscalationLevelTarget(
                                                  policy.id,
                                                  lIndex,
                                                  user.id
                                                )
                                              }
                                            >
                                              {user.name}
                                            </Badge>
                                          );
                                        })}
                                        {onCallUsers.length === 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            No on-call users configured
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oncall" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>On-Call Roster</CardTitle>
                    <CardDescription>Manage who participates in on-call and their status</CardDescription>
                  </div>
                  <Button size="sm" onClick={addOnCallUser}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {onCallUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No on-call users configured. Add at least one user to use escalation policies effectively.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {onCallUsers.map((user) => (
                      <Card key={user.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={user.name}
                                    onChange={(e) =>
                                      updateOnCallUser(user.id, 'name', e.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Email</Label>
                                  <Input
                                    value={user.email}
                                    onChange={(e) =>
                                      updateOnCallUser(user.id, 'email', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <Label className="text-xs">Status</Label>
                                  <Select
                                    value={user.status}
                                    onValueChange={(value: 'on-call' | 'off-call') =>
                                      updateOnCallUser(user.id, 'status', value)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="on-call">On-Call</SelectItem>
                                      <SelectItem value="off-call">Off-Call</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Badge variant={user.status === 'on-call' ? 'default' : 'outline'}>
                                  {user.status === 'on-call' ? 'On-Call' : 'Off-Call'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOnCallUser(user.id)}
                              disabled={onCallUsers.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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

