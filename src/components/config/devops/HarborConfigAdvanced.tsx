import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  Folder,
  Tag,
  Shield,
  RefreshCw,
  Users,
  Settings,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy
} from 'lucide-react';

interface HarborConfigProps {
  componentId: string;
}

interface Project {
  id: string;
  name: string;
  public: boolean;
  repositories: number;
  tags: number;
  vulnerabilityCount?: number;
  storageUsed?: number;
  accessLevel?: 'private' | 'public';
}

interface Repository {
  id: string;
  name: string;
  project: string;
  tags: number;
  pullCount: number;
  lastPush?: string;
  size?: number;
}

interface ImageTag {
  id: string;
  name: string;
  repository: string;
  digest: string;
  size: number;
  created?: string;
  vulnerabilityScan?: VulnerabilityScan;
  signed?: boolean;
}

interface VulnerabilityScan {
  status: 'pending' | 'running' | 'completed' | 'error';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  totalVulnerabilities?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  scannedAt?: string;
}

interface ReplicationPolicy {
  id: string;
  name: string;
  sourceRegistry: string;
  destinationRegistry: string;
  trigger: 'manual' | 'event-based' | 'scheduled';
  enabled: boolean;
  filters?: string[];
}

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'developer' | 'guest';
  enabled: boolean;
}

interface HarborConfig {
  serverUrl?: string;
  adminUsername?: string;
  adminPassword?: string;
  enableVulnerabilityScanning?: boolean;
  enableContentTrust?: boolean;
  enableImageScanning?: boolean;
  projects?: Project[];
  repositories?: Repository[];
  tags?: ImageTag[];
  replicationPolicies?: ReplicationPolicy[];
  users?: User[];
  selectedProject?: string;
}

export function HarborConfigAdvanced({ componentId }: HarborConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as HarborConfig;
  const serverUrl = config.serverUrl || 'https://harbor.example.com';
  const adminUsername = config.adminUsername || 'admin';
  const adminPassword = config.adminPassword || '';
  const enableVulnerabilityScanning = config.enableVulnerabilityScanning ?? true;
  const enableContentTrust = config.enableContentTrust ?? false;
  const enableImageScanning = config.enableImageScanning ?? true;
  const projects = config.projects || [
    {
      id: '1',
      name: 'archiphoenix',
      public: false,
      repositories: 12,
      tags: 45,
      vulnerabilityCount: 3,
      storageUsed: 2.5,
      accessLevel: 'private'
    },
    {
      id: '2',
      name: 'public-images',
      public: true,
      repositories: 8,
      tags: 23,
      vulnerabilityCount: 0,
      storageUsed: 1.2,
      accessLevel: 'public'
    }
  ];
  const repositories = config.repositories || [
    {
      id: '1',
      name: 'archiphoenix/web-app',
      project: 'archiphoenix',
      tags: 5,
      pullCount: 1250,
      lastPush: '2 hours ago',
      size: 450
    },
    {
      id: '2',
      name: 'archiphoenix/api-server',
      project: 'archiphoenix',
      tags: 8,
      pullCount: 890,
      lastPush: '1 day ago',
      size: 320
    }
  ];
  const tags = config.tags || [
    {
      id: '1',
      name: 'latest',
      repository: 'archiphoenix/web-app',
      digest: 'sha256:abc123...',
      size: 125,
      created: '2024-01-15T10:30:00Z',
      vulnerabilityScan: {
        status: 'completed',
        severity: 'medium',
        totalVulnerabilities: 5,
        critical: 0,
        high: 1,
        medium: 3,
        low: 1,
        scannedAt: '2024-01-15T11:00:00Z'
      },
      signed: true
    },
    {
      id: '2',
      name: 'v1.2.3',
      repository: 'archiphoenix/web-app',
      digest: 'sha256:def456...',
      size: 120,
      created: '2024-01-14T15:20:00Z',
      vulnerabilityScan: {
        status: 'completed',
        severity: 'low',
        totalVulnerabilities: 2,
        critical: 0,
        high: 0,
        medium: 1,
        low: 1,
        scannedAt: '2024-01-14T16:00:00Z'
      },
      signed: false
    }
  ];
  const replicationPolicies = config.replicationPolicies || [
    {
      id: '1',
      name: 'prod-replication',
      sourceRegistry: 'harbor-prod',
      destinationRegistry: 'harbor-backup',
      trigger: 'event-based',
      enabled: true,
      filters: ['archiphoenix/**']
    }
  ];
  const users = config.users || [
    {
      id: '1',
      username: 'admin',
      email: 'admin@archiphoenix.com',
      role: 'admin',
      enabled: true
    },
    {
      id: '2',
      username: 'developer1',
      email: 'dev1@archiphoenix.com',
      role: 'developer',
      enabled: true
    }
  ];
  const selectedProject = config.selectedProject || projects[0]?.name || '';

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateReplication, setShowCreateReplication] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const updateConfig = (updates: Partial<HarborConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addProject = () => {
    const newProject: Project = {
      id: String(projects.length + 1),
      name: 'new-project',
      public: false,
      repositories: 0,
      tags: 0,
      accessLevel: 'private'
    };
    updateConfig({ projects: [...projects, newProject] });
    setShowCreateProject(false);
  };

  const removeProject = (index: number) => {
    updateConfig({ projects: projects.filter((_, i) => i !== index) });
  };

  const updateProject = (index: number, field: keyof Project, value: any) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ projects: updated });
  };

  const addReplicationPolicy = () => {
    const newPolicy: ReplicationPolicy = {
      id: String(replicationPolicies.length + 1),
      name: 'new-replication',
      sourceRegistry: 'source-registry',
      destinationRegistry: 'dest-registry',
      trigger: 'manual',
      enabled: true
    };
    updateConfig({ replicationPolicies: [...replicationPolicies, newPolicy] });
    setShowCreateReplication(false);
  };

  const removeReplicationPolicy = (index: number) => {
    updateConfig({ replicationPolicies: replicationPolicies.filter((_, i) => i !== index) });
  };

  const addUser = () => {
    const newUser: User = {
      id: String(users.length + 1),
      username: 'new-user',
      email: 'user@example.com',
      role: 'guest',
      enabled: true
    };
    updateConfig({ users: [...users, newUser] });
    setShowCreateUser(false);
  };

  const removeUser = (index: number) => {
    updateConfig({ users: users.filter((_, i) => i !== index) });
  };

  const updateUser = (index: number, field: keyof User, value: any) => {
    const updated = [...users];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ users: updated });
  };

  const scanVulnerability = (tagId: string) => {
    const updated = [...tags];
    const tagIndex = updated.findIndex(t => t.id === tagId);
    if (tagIndex !== -1) {
      updated[tagIndex].vulnerabilityScan = {
        status: 'running',
        severity: 'none',
        scannedAt: new Date().toISOString()
      };
      updateConfig({ tags: updated });
      // Simulate scan completion
      setTimeout(() => {
        const completed = [...tags];
        const completedIndex = completed.findIndex(t => t.id === tagId);
        if (completedIndex !== -1) {
          completed[completedIndex].vulnerabilityScan = {
            status: 'completed',
            severity: 'medium',
            totalVulnerabilities: Math.floor(Math.random() * 10),
            critical: Math.floor(Math.random() * 2),
            high: Math.floor(Math.random() * 3),
            medium: Math.floor(Math.random() * 4),
            low: Math.floor(Math.random() * 3),
            scannedAt: new Date().toISOString()
          };
          updateConfig({ tags: completed });
        }
      }, 2000);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  const filteredRepositories = repositories.filter(repo => {
    if (selectedProject && repo.project !== selectedProject) return false;
    if (searchQuery && !repo.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Harbor Registry</h2>
              <p className="text-sm text-muted-foreground mt-1">Container image registry & vulnerability scanning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v2.10</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure Harbor registry connection</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Server URL</Label>
              <Input
                value={serverUrl}
                onChange={(e) => updateConfig({ serverUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Username</Label>
              <Input
                value={adminUsername}
                onChange={(e) => updateConfig({ adminUsername: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Password</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => updateConfig({ adminPassword: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Configure security features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Vulnerability Scanning</Label>
                <p className="text-sm text-muted-foreground">Automatically scan images for vulnerabilities</p>
              </div>
              <Switch
                checked={enableVulnerabilityScanning}
                onCheckedChange={(checked) => updateConfig({ enableVulnerabilityScanning: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Content Trust</Label>
                <p className="text-sm text-muted-foreground">Require signed images</p>
              </div>
              <Switch
                checked={enableContentTrust}
                onCheckedChange={(checked) => updateConfig({ enableContentTrust: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Image Scanning</Label>
                <p className="text-sm text-muted-foreground">Scan images on push</p>
              </div>
              <Switch
                checked={enableImageScanning}
                onCheckedChange={(checked) => updateConfig({ enableImageScanning: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="projects" className="gap-2">
              <Folder className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="repositories" className="gap-2">
              <Package className="h-4 w-4" />
              Repositories
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="replication" className="gap-2">
              <Copy className="h-4 w-4" />
              Replication
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Manage container image projects</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateProject(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </CardHeader>
              {showCreateProject && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Project Name</Label>
                      <Input placeholder="new-project" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addProject}>Create Project</Button>
                      <Button variant="outline" onClick={() => setShowCreateProject(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {projects.map((project, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{project.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {project.repositories} repositories • {project.tags} tags
                          {project.storageUsed && ` • ${project.storageUsed} GB`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.public ? 'default' : 'secondary'}>
                          {project.accessLevel || (project.public ? 'Public' : 'Private')}
                        </Badge>
                        {project.vulnerabilityCount !== undefined && project.vulnerabilityCount > 0 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {project.vulnerabilityCount}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => removeProject(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={project.public}
                        onCheckedChange={(checked) => updateProject(index, 'public', checked)}
                      />
                      <Label>Public Project</Label>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Repositories Tab */}
          <TabsContent value="repositories" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Repositories</CardTitle>
                  <CardDescription>Container image repositories</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedProject} onValueChange={(value) => updateConfig({ selectedProject: value })}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Projects</SelectItem>
                      {projects.map((proj, idx) => (
                        <SelectItem key={idx} value={proj.name}>{proj.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 w-64"
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredRepositories.map((repo, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{repo.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {repo.tags} tags • {repo.pullCount} pulls
                          {repo.size && ` • ${repo.size} MB`}
                          {repo.lastPush && ` • Last push: ${repo.lastPush}`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRepository(selectedRepository === repo.name ? '' : repo.name)}
                      >
                        {selectedRepository === repo.name ? 'Hide Tags' : 'View Tags'}
                      </Button>
                    </div>
                    {selectedRepository === repo.name && (
                      <div className="pt-2 border-t space-y-2">
                        {tags.filter(t => t.repository === repo.name).map((tag, tagIdx) => (
                          <div key={tagIdx} className="p-2 border rounded bg-muted/50 flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-mono text-sm">{tag.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {tag.digest.substring(0, 20)}... • {tag.size} MB
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {tag.vulnerabilityScan && (
                                <Badge variant={tag.vulnerabilityScan.severity === 'none' ? 'default' : 'destructive'}>
                                  {tag.vulnerabilityScan.severity}
                                </Badge>
                              )}
                              {tag.signed && (
                                <Badge variant="outline">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Signed
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Image Tags</CardTitle>
                <CardDescription>Manage and scan container image tags</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tags.map((tag, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{tag.repository}:{tag.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {tag.digest} • {tag.size} MB
                          {tag.created && ` • Created: ${new Date(tag.created).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tag.vulnerabilityScan && (
                          <Badge
                            variant={tag.vulnerabilityScan.severity === 'none' ? 'default' : 'destructive'}
                            className={getSeverityColor(tag.vulnerabilityScan.severity)}
                          >
                            {tag.vulnerabilityScan.severity}
                          </Badge>
                        )}
                        {tag.signed && (
                          <Badge variant="outline">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Signed
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => scanVulnerability(tag.id)}
                          disabled={tag.vulnerabilityScan?.status === 'running'}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          {tag.vulnerabilityScan?.status === 'running' ? 'Scanning...' : 'Scan'}
                        </Button>
                      </div>
                    </div>
                    {tag.vulnerabilityScan && tag.vulnerabilityScan.status === 'completed' && (
                      <div className="pt-2 border-t space-y-2">
                        <div className="grid grid-cols-5 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-red-500">{tag.vulnerabilityScan.critical || 0}</div>
                            <div className="text-xs text-muted-foreground">Critical</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-orange-500">{tag.vulnerabilityScan.high || 0}</div>
                            <div className="text-xs text-muted-foreground">High</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-yellow-500">{tag.vulnerabilityScan.medium || 0}</div>
                            <div className="text-xs text-muted-foreground">Medium</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-500">{tag.vulnerabilityScan.low || 0}</div>
                            <div className="text-xs text-muted-foreground">Low</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{tag.vulnerabilityScan.totalVulnerabilities || 0}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                        </div>
                        {tag.vulnerabilityScan.scannedAt && (
                          <div className="text-xs text-muted-foreground">
                            Scanned: {new Date(tag.vulnerabilityScan.scannedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Replication Tab */}
          <TabsContent value="replication" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Replication Policies</CardTitle>
                  <CardDescription>Configure image replication between registries</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateReplication(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Button>
              </CardHeader>
              {showCreateReplication && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Policy Name</Label>
                      <Input placeholder="replication-policy" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addReplicationPolicy}>Create Policy</Button>
                      <Button variant="outline" onClick={() => setShowCreateReplication(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {replicationPolicies.map((policy, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{policy.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policy.sourceRegistry} → {policy.destinationRegistry}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{policy.trigger}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeReplicationPolicy(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {policy.filters && policy.filters.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Filters</Label>
                        <div className="flex flex-wrap gap-1">
                          {policy.filters.map((filter, filterIdx) => (
                            <Badge key={filterIdx} variant="outline" className="text-xs">{filter}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage Harbor users and permissions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateUser(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardHeader>
              {showCreateUser && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input placeholder="new-user" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addUser}>Add User</Button>
                      <Button variant="outline" onClick={() => setShowCreateUser(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {users.map((user, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                        <Switch
                          checked={user.enabled}
                          onCheckedChange={(checked) => updateUser(index, 'enabled', checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeUser(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={user.role}
                          onValueChange={(value) => updateUser(index, 'role', value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="guest">Guest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

