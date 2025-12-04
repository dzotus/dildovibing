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
}

export function PagerDutyConfigAdvanced({ componentId }: PagerDutyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PagerDutyConfig;
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
  const incidents = config.incidents || [
    {
      id: '1',
      title: 'High CPU usage detected',
      service: 'archiphoenix-service',
      status: 'triggered',
      severity: 'critical',
      createdAt: new Date().toISOString(),
    },
  ];
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
  const totalIncidents = config.totalIncidents || incidents.length;
  const activeIncidents = config.activeIncidents || incidents.filter((i) => i.status !== 'resolved').length;
  const resolvedIncidents = config.resolvedIncidents || incidents.filter((i) => i.status === 'resolved').length;

  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

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
    const newIncidents = incidents.map((i) =>
      i.id === id ? { ...i, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : i
    );
    updateConfig({ incidents: newIncidents });
  };

  const resolveIncident = (id: string) => {
    const newIncidents = incidents.map((i) =>
      i.id === id ? { ...i, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : i
    );
    updateConfig({ incidents: newIncidents });
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
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{policy.name}</CardTitle>
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
                      <CardContent>
                        <div className="space-y-2">
                          {policy.levels.map((level, lIndex) => (
                            <Card key={lIndex} className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">Level {level.level}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Timeout: {level.timeout} min • Targets: {level.targets.length}
                                  </p>
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
                <CardTitle>On-Call Schedule</CardTitle>
                <CardDescription>Manage on-call users and schedules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {onCallUsers.map((user) => (
                    <Card key={user.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <Badge variant={user.status === 'on-call' ? 'default' : 'outline'}>
                            {user.status === 'on-call' ? 'On-Call' : 'Off-Call'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

