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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { showSuccess, showError, showValidationError, showWarning } from '@/utils/toast';
import { useEmulationStore } from '@/store/useEmulationStore';
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
  
  // Get component metrics from emulation store
  const componentMetrics = useEmulationStore((state) => 
    state.componentMetrics.get(componentId)
  );

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as HarborConfig;
  const serverUrl = config.serverUrl || 'https://harbor.example.com';
  const adminUsername = config.adminUsername || 'admin';
  const adminPassword = config.adminPassword || '';
  const enableVulnerabilityScanning = config.enableVulnerabilityScanning ?? true;
  const enableContentTrust = config.enableContentTrust ?? false;
  const enableImageScanning = config.enableImageScanning ?? true;
  const projects = config.projects || [];
  const repositories = config.repositories || [];
  const tags = config.tags || [];
  const replicationPolicies = config.replicationPolicies || [];
  const users = config.users || [];
  const selectedProject = config.selectedProject || 'all';

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateReplication, setShowCreateReplication] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newReplicationName, setNewReplicationName] = useState('');
  const [newReplicationSource, setNewReplicationSource] = useState('');
  const [newReplicationDest, setNewReplicationDest] = useState('');
  const [newReplicationTrigger, setNewReplicationTrigger] = useState<'manual' | 'event-based' | 'scheduled'>('manual');
  
  // Delete confirmations
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [replicationToDelete, setReplicationToDelete] = useState<string | null>(null);

  const updateConfig = (updates: Partial<HarborConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Validation helpers
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateProjectName = (name: string): boolean => {
    return name.trim().length > 0 && !projects.some(p => p.name === name.trim());
  };

  const validateUsername = (username: string): boolean => {
    return username.trim().length > 0 && !users.some(u => u.username === username.trim());
  };

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Project operations
  const addProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      showValidationError('Project name is required');
      return;
    }
    if (!validateProjectName(trimmedName)) {
      showValidationError('Project name must be unique');
      return;
    }
    const newProject: Project = {
      id: generateId(),
      name: trimmedName,
      public: false,
      repositories: 0,
      tags: 0,
      accessLevel: 'private'
    };
    updateConfig({ projects: [...projects, newProject] });
    setNewProjectName('');
    setShowCreateProject(false);
    showSuccess(`Project "${trimmedName}" created successfully`);
  };

  const removeProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Count actual repositories from the repositories array
    const projectRepositoriesCount = repositories.filter(repo => repo.project === project.name).length;
    
    if (projectRepositoriesCount > 0) {
      showError(`Cannot delete project "${project.name}" because it contains ${projectRepositoriesCount} repositories`);
      return;
    }
    
    updateConfig({ projects: projects.filter(p => p.id !== projectId) });
    setProjectToDelete(null);
    showSuccess(`Project "${project.name}" deleted successfully`);
  };

  const updateProject = (projectId: string, field: keyof Project, value: any) => {
    const updated = projects.map(p => 
      p.id === projectId ? { ...p, [field]: value } : p
    );
    updateConfig({ projects: updated });
  };

  // Replication policy operations
  const addReplicationPolicy = () => {
    const trimmedName = newReplicationName.trim();
    if (!trimmedName) {
      showValidationError('Policy name is required');
      return;
    }
    if (!newReplicationSource.trim() || !newReplicationDest.trim()) {
      showValidationError('Source and destination registries are required');
      return;
    }
    const newPolicy: ReplicationPolicy = {
      id: generateId(),
      name: trimmedName,
      sourceRegistry: newReplicationSource.trim(),
      destinationRegistry: newReplicationDest.trim(),
      trigger: newReplicationTrigger,
      enabled: true
    };
    updateConfig({ replicationPolicies: [...replicationPolicies, newPolicy] });
    setNewReplicationName('');
    setNewReplicationSource('');
    setNewReplicationDest('');
    setNewReplicationTrigger('manual');
    setShowCreateReplication(false);
    showSuccess(`Replication policy "${trimmedName}" created successfully`);
  };

  const removeReplicationPolicy = (policyId: string) => {
    const policy = replicationPolicies.find(p => p.id === policyId);
    if (!policy) return;
    updateConfig({ replicationPolicies: replicationPolicies.filter(p => p.id !== policyId) });
    setReplicationToDelete(null);
    showSuccess(`Replication policy "${policy.name}" deleted successfully`);
  };

  // User operations
  const addUser = () => {
    const trimmedUsername = newUsername.trim();
    const trimmedEmail = newUserEmail.trim();
    if (!trimmedUsername) {
      showValidationError('Username is required');
      return;
    }
    if (!trimmedEmail) {
      showValidationError('Email is required');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      showValidationError('Invalid email format');
      return;
    }
    if (!validateUsername(trimmedUsername)) {
      showValidationError('Username must be unique');
      return;
    }
    const newUser: User = {
      id: generateId(),
      username: trimmedUsername,
      email: trimmedEmail,
      role: 'guest',
      enabled: true
    };
    updateConfig({ users: [...users, newUser] });
    setNewUsername('');
    setNewUserEmail('');
    setShowCreateUser(false);
    showSuccess(`User "${trimmedUsername}" created successfully`);
  };

  const removeUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    updateConfig({ users: users.filter(u => u.id !== userId) });
    setUserToDelete(null);
    showSuccess(`User "${user.username}" deleted successfully`);
  };

  const updateUser = (userId: string, field: keyof User, value: any) => {
    if (field === 'email' && typeof value === 'string' && !validateEmail(value)) {
      showValidationError('Invalid email format');
      return;
    }
    const updated = users.map(u => 
      u.id === userId ? { ...u, [field]: value } : u
    );
    updateConfig({ users: updated });
  };

  const scanVulnerability = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
    if (tag.vulnerabilityScan?.status === 'running') {
      showWarning('Scan already in progress');
      return;
    }

    const updated = tags.map(t => 
      t.id === tagId ? {
        ...t,
        vulnerabilityScan: {
          status: 'pending' as const,
          severity: 'none' as const,
          scannedAt: new Date().toISOString()
        }
      } : t
    );
    updateConfig({ tags: updated });
    showSuccess(`Vulnerability scan queued for ${tag.repository}:${tag.name}`);
    // Scan will be processed by HarborEmulationEngine during simulation
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
    if (selectedProject && selectedProject !== 'all' && repo.project !== selectedProject) return false;
    if (searchQuery && !repo.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Get Harbor-specific metrics
  const harborMetrics = componentMetrics?.customMetrics || {};
  const pushOpsPerSec = harborMetrics.harbor_push_ops_per_sec || 0;
  const pullOpsPerSec = harborMetrics.harbor_pull_ops_per_sec || 0;
  const scanOpsPerSec = harborMetrics.harbor_scan_ops_per_sec || 0;
  const storageUsed = harborMetrics.harbor_storage_used || 0;
  const storageTotal = harborMetrics.harbor_storage_total || 100;
  const scansRunning = harborMetrics.harbor_scans_running || 0;
  const vulnerabilitiesTotal = harborMetrics.harbor_vulnerabilities_total || 0;

  // Get component status based on metrics
  const getComponentStatus = () => {
    if (!componentMetrics) return { status: 'stopped', color: 'gray', label: 'Stopped' };
    
    if (componentMetrics.errorRate > 0.5) {
      return { status: 'error', color: 'red', label: 'Error' };
    }
    
    if (componentMetrics.utilization > 0 || componentMetrics.throughput > 0 || scansRunning > 0) {
      return { status: 'running', color: 'green', label: 'Running' };
    }
    
    return { status: 'stopped', color: 'gray', label: 'Stopped' };
  };

  const status = getComponentStatus();

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
            <Badge 
              variant={status.status === 'error' ? 'destructive' : status.status === 'running' ? 'default' : 'secondary'} 
              className="gap-2"
            >
              <div 
                className={`h-2 w-2 rounded-full ${status.status === 'running' ? 'bg-green-500 animate-pulse' : status.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`}
              />
              {status.label}
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

        {/* Metrics Section */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
            <CardDescription>Real-time Harbor metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Push Ops/sec</div>
                <div className="text-2xl font-bold">{pushOpsPerSec.toFixed(2)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Pull Ops/sec</div>
                <div className="text-2xl font-bold">{pullOpsPerSec.toFixed(2)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Scan Ops/sec</div>
                <div className="text-2xl font-bold">{scanOpsPerSec.toFixed(2)}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-medium">{storageUsed.toFixed(2)} GB / {storageTotal.toFixed(2)} GB</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, (storageUsed / storageTotal) * 100)}%` }}
                  />
                </div>
              </div>
              {componentMetrics && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Average Latency: </span>
                    <span className="font-medium">{componentMetrics.latency.toFixed(0)} ms</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Throughput: </span>
                    <span className="font-medium">{componentMetrics.throughput.toFixed(2)} ops/sec</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scans Running: </span>
                    <span className="font-medium">{scansRunning}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Vulnerabilities: </span>
                    <span className="font-medium">{vulnerabilitiesTotal}</span>
                  </div>
                </div>
              )}
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
                      <Input 
                        placeholder="new-project" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addProject} disabled={!newProjectName.trim()}>Create Project</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateProject(false);
                        setNewProjectName('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No projects yet. Create your first project to get started.
                  </div>
                ) : (
                  projects.map((project) => {
                    // Calculate real counts from repositories and tags arrays
                    const projectRepos = repositories.filter(repo => repo.project === project.name);
                    const projectTags = tags.filter(tag => 
                      projectRepos.some(repo => tag.repository === repo.name)
                    );
                    const projectRepoCount = projectRepos.length;
                    const projectTagCount = projectTags.length;
                    const projectVulnCount = projectTags.reduce((sum, tag) => 
                      sum + (tag.vulnerabilityScan?.totalVulnerabilities || 0), 0
                    );
                    
                    return (
                      <div key={project.id} className="p-4 border border-border rounded-lg bg-card space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-semibold">{project.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {projectRepoCount} repositories • {projectTagCount} tags
                              {project.storageUsed && ` • ${project.storageUsed} GB`}
                            </div>
                          </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.public ? 'default' : 'secondary'}>
                          {project.accessLevel || (project.public ? 'Public' : 'Private')}
                        </Badge>
                        {projectVulnCount > 0 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {projectVulnCount}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setProjectToDelete(project.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={project.public}
                        onCheckedChange={(checked) => updateProject(project.id, 'public', checked)}
                      />
                      <Label>Public Project</Label>
                    </div>
                  </div>
                    );
                  })
                )}
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
                  <Select 
                    value={selectedProject} 
                    onValueChange={(value) => {
                      const newValue = value === 'all' ? undefined : value;
                      updateConfig({ selectedProject: newValue });
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map((proj) => (
                        <SelectItem key={proj.id} value={proj.name}>{proj.name}</SelectItem>
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
                {filteredRepositories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No repositories yet. Repositories will appear when images are pushed to projects.
                  </div>
                ) : (
                  filteredRepositories.map((repo) => {
                    // Calculate real tag count from tags array
                    const repoTags = tags.filter(tag => tag.repository === repo.name);
                    const repoTagCount = repoTags.length;
                    
                    return (
                      <div key={repo.id} className="p-4 border border-border rounded-lg bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-semibold font-mono">{repo.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {repoTagCount} tags
                              {repo.pullCount > 0 && ` • ${repo.pullCount} pulls`}
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
                        {tags.filter(t => t.repository === repo.name).map((tag) => (
                          <div key={tag.id} className="p-2 border rounded bg-muted/50 flex items-center justify-between">
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
                    );
                  })
                )}
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
                {tags.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No image tags yet. Tags will appear when images are pushed to repositories.
                  </div>
                ) : (
                  tags.map((tag) => (
                  <div key={tag.id} className="p-4 border border-border rounded-lg bg-card space-y-3">
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
                  ))
                )}
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
                      <Input 
                        placeholder="replication-policy" 
                        value={newReplicationName}
                        onChange={(e) => setNewReplicationName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Source Registry</Label>
                        <Input 
                          placeholder="source-registry" 
                          value={newReplicationSource}
                          onChange={(e) => setNewReplicationSource(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Destination Registry</Label>
                        <Input 
                          placeholder="dest-registry" 
                          value={newReplicationDest}
                          onChange={(e) => setNewReplicationDest(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Trigger</Label>
                      <Select value={newReplicationTrigger} onValueChange={(value: 'manual' | 'event-based' | 'scheduled') => setNewReplicationTrigger(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="event-based">Event-based</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={addReplicationPolicy} 
                        disabled={!newReplicationName.trim() || !newReplicationSource.trim() || !newReplicationDest.trim()}
                      >
                        Create Policy
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateReplication(false);
                        setNewReplicationName('');
                        setNewReplicationSource('');
                        setNewReplicationDest('');
                        setNewReplicationTrigger('manual');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {replicationPolicies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No replication policies yet. Create a policy to replicate images between registries.
                  </div>
                ) : (
                  replicationPolicies.map((policy) => (
                  <div key={policy.id} className="p-4 border border-border rounded-lg bg-card space-y-3">
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
                        <Button variant="ghost" size="icon" onClick={() => setReplicationToDelete(policy.id)}>
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
                  ))
                )}
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
                      <Input 
                        placeholder="new-user" 
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input 
                        type="email"
                        placeholder="user@example.com" 
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={addUser} 
                        disabled={!newUsername.trim() || !newUserEmail.trim()}
                      >
                        Add User
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateUser(false);
                        setNewUsername('');
                        setNewUserEmail('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users yet. Add users to manage access to Harbor registry.
                  </div>
                ) : (
                  users.map((user) => (
                  <div key={user.id} className="p-4 border border-border rounded-lg bg-card space-y-3">
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
                          onCheckedChange={(checked) => updateUser(user.id, 'enabled', checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setUserToDelete(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={user.role}
                          onValueChange={(value) => updateUser(user.id, 'role', value as any)}
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
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={user.email}
                          onChange={(e) => updateUser(user.id, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialogs */}
        <AlertDialog open={projectToDelete !== null} onOpenChange={(open) => !open && setProjectToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete project "{projects.find(p => p.id === projectToDelete)?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => projectToDelete && removeProject(projectToDelete)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={userToDelete !== null} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete user "{users.find(u => u.id === userToDelete)?.username}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => userToDelete && removeUser(userToDelete)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={replicationToDelete !== null} onOpenChange={(open) => !open && setReplicationToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Replication Policy</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete replication policy "{replicationPolicies.find(p => p.id === replicationToDelete)?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => replicationToDelete && removeReplicationPolicy(replicationToDelete)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

