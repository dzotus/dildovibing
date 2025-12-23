import { useState, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { ArgoCDEmulationEngine, ArgoCDApplication, ArgoCDRepository, ArgoCDProject, ArgoCDSyncOperation } from '@/core/ArgoCDEmulationEngine';
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
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, 
  CheckCircle2, 
  Settings, 
  Activity,
  RefreshCw,
  XCircle,
  Clock,
  Plus,
  Trash2,
  GitBranch,
  Database,
  FolderGit2,
  Users,
  Bell,
  Search,
  Filter,
  Edit,
  Play,
  RotateCcw,
  History,
  AlertCircle,
  Shield,
  Globe,
  Server,
  Eye,
  EyeOff,
  X,
  Save,
  Copy,
  Download,
  Upload
} from 'lucide-react';

interface ArgoCDConfigProps {
  componentId: string;
}

interface ArgoCDConfig {
  serverUrl?: string;
  enableSSO?: boolean;
  ssoProvider?: 'oidc' | 'saml' | 'ldap';
  enableRBAC?: boolean;
  enableSyncPolicy?: boolean;
  autoSync?: boolean;
  syncPolicy?: 'automated' | 'manual' | 'sync-window';
  enableHealthChecks?: boolean;
  enableNotifications?: boolean;
  notificationChannels?: string[];
  applications?: Array<{
    name: string;
    namespace?: string;
    project?: string;
    repository: string;
    path?: string;
    targetRevision?: string;
    destination?: {
      server?: string;
      namespace?: string;
    };
    syncPolicy?: 'automated' | 'manual' | 'sync-window';
  }>;
  repositories?: Array<{
    name: string;
    url: string;
    type?: 'git' | 'helm' | 'oci';
    username?: string;
    password?: string;
    insecure?: boolean;
    project?: string;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    sourceRepos?: string[];
    destinations?: Array<{
      server?: string;
      namespace?: string;
    }>;
  }>;
  roles?: Array<{
    name: string;
    description?: string;
    policies?: string[];
    groups?: string[];
  }>;
}

export function ArgoCDConfigAdvanced({ componentId }: ArgoCDConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Argo CD emulation engine
  const argoCDEngine = emulationEngine.getArgoCDEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

  const config = (node.data.config as any) || {} as ArgoCDConfig;

  // Real-time data from emulation
  const [realApplications, setRealApplications] = useState<ArgoCDApplication[]>([]);
  const [realRepositories, setRealRepositories] = useState<ArgoCDRepository[]>([]);
  const [realProjects, setRealProjects] = useState<ArgoCDProject[]>([]);
  const [realSyncOperations, setRealSyncOperations] = useState<ArgoCDSyncOperation[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'outofsync' | 'progressing' | 'degraded'>('all');
  const [filterHealth, setFilterHealth] = useState<'all' | 'healthy' | 'degraded' | 'progressing'>('all');
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);
  const [showAddApplication, setShowAddApplication] = useState(false);
  const [showEditApplication, setShowEditApplication] = useState(false);
  const [showAddRepository, setShowAddRepository] = useState(false);
  const [showEditRepository, setShowEditRepository] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingApplication, setEditingApplication] = useState<ArgoCDApplication | null>(null);
  const [editingRepository, setEditingRepository] = useState<ArgoCDRepository | null>(null);
  const [editingProject, setEditingProject] = useState<ArgoCDProject | null>(null);

  // Form states for new application
  const [newAppName, setNewAppName] = useState('');
  const [newAppNamespace, setNewAppNamespace] = useState('default');
  const [newAppProject, setNewAppProject] = useState('default');
  const [newAppRepository, setNewAppRepository] = useState('');
  const [newAppPath, setNewAppPath] = useState('.');
  const [newAppTargetRevision, setNewAppTargetRevision] = useState('main');
  const [newAppDestinationServer, setNewAppDestinationServer] = useState('https://kubernetes.default.svc');
  const [newAppDestinationNamespace, setNewAppDestinationNamespace] = useState('default');
  const [newAppSyncPolicy, setNewAppSyncPolicy] = useState<'automated' | 'manual' | 'sync-window'>('manual');

  // Form states for new repository
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoType, setNewRepoType] = useState<'git' | 'helm' | 'oci'>('git');
  const [newRepoUsername, setNewRepoUsername] = useState('');
  const [newRepoPassword, setNewRepoPassword] = useState('');
  const [newRepoInsecure, setNewRepoInsecure] = useState(false);
  const [newRepoProject, setNewRepoProject] = useState('');

  // Form states for new project
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectSourceRepos, setNewProjectSourceRepos] = useState<string[]>([]);
  const [newProjectDestinations, setNewProjectDestinations] = useState<Array<{ server?: string; namespace?: string }>>([]);

  // Validation errors
  const [appNameError, setAppNameError] = useState<string>('');
  const [repoNameError, setRepoNameError] = useState<string>('');
  const [repoUrlError, setRepoUrlError] = useState<string>('');
  const [projectNameError, setProjectNameError] = useState<string>('');

  // Update real-time data from emulation
  useEffect(() => {
    if (!argoCDEngine) return;
    
    const updateData = () => {
      try {
        const applications = argoCDEngine.getApplications();
        const repositories = argoCDEngine.getRepositories();
        const projects = argoCDEngine.getProjects();
        const syncOperations = argoCDEngine.getSyncOperations();
        const metrics = argoCDEngine.getMetrics();
        
        setRealApplications(applications);
        setRealRepositories(repositories);
        setRealProjects(projects);
        setRealSyncOperations(syncOperations);
        setRealMetrics(metrics);
      } catch (error) {
        console.error('Error updating Argo CD data:', error);
      }
    };
    
    updateData();
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    return () => clearInterval(interval);
  }, [argoCDEngine, isRunning]);

  // Sync config with emulation engine when it changes (only when config actually changes)
  useEffect(() => {
    if (!argoCDEngine || !node) return;
    
    // Use a ref to track if we've already initialized to avoid infinite loops
    const configKey = JSON.stringify({
      apps: config.applications?.map(a => a.name).sort(),
      repos: config.repositories?.map(r => r.name).sort(),
      projects: config.projects?.map(p => p.name).sort(),
    });
    
    // Only sync if config structure changed (not runtime state)
    argoCDEngine.initializeConfig(node);
  }, [argoCDEngine, node, config.applications?.length, config.repositories?.length, config.projects?.length]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    let filtered = realApplications.length > 0 ? realApplications : (config.applications || []);
    
    if (searchQuery) {
      filtered = filtered.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.namespace && app.namespace.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (app.repository && app.repository.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }
    
    if (filterHealth !== 'all') {
      filtered = filtered.filter(app => app.health === filterHealth);
    }
    
    return filtered;
  }, [realApplications, config.applications, searchQuery, filterStatus, filterHealth]);

  // Filtered repositories
  const filteredRepositories = useMemo(() => {
    let filtered = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
    
    if (searchQuery) {
      filtered = filtered.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.url.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [realRepositories, config.repositories, searchQuery]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let filtered = realProjects.length > 0 ? realProjects : (config.projects || []);
    
    if (searchQuery) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return filtered;
  }, [realProjects, config.projects, searchQuery]);

  // Calculate stats from real metrics or config
  const stats = useMemo(() => {
    if (realMetrics) {
      return {
        totalApps: realMetrics.applicationsTotal || 0,
        syncedApps: realMetrics.applicationsSynced || 0,
        outOfSyncApps: realMetrics.applicationsOutOfSync || 0,
        progressingApps: realMetrics.applicationsProgressing || 0,
        degradedApps: realMetrics.applicationsDegraded || 0,
        healthyApps: realMetrics.applicationsHealthy || 0,
        syncRate: realMetrics.syncRate || 0,
        repositoriesTotal: realMetrics.repositoriesTotal || 0,
        repositoriesConnected: realMetrics.repositoriesConnected || 0,
        projectsTotal: realMetrics.projectsTotal || 0,
      };
    }
    
    const apps = realApplications.length > 0 ? realApplications : (config.applications || []);
    return {
      totalApps: apps.length,
      syncedApps: apps.filter(a => a.status === 'synced').length,
      outOfSyncApps: apps.filter(a => a.status === 'outofsync').length,
      progressingApps: apps.filter(a => a.status === 'progressing').length,
      degradedApps: apps.filter(a => a.status === 'degraded').length,
      healthyApps: apps.filter(a => a.health === 'healthy').length,
      syncRate: 0,
      repositoriesTotal: realRepositories.length || config.repositories?.length || 0,
      repositoriesConnected: realRepositories.filter(r => r.connectionStatus === 'successful').length,
      projectsTotal: realProjects.length || config.projects?.length || 0,
    };
  }, [realMetrics, realApplications, realRepositories, realProjects, config]);

  const updateConfig = (updates: Partial<ArgoCDConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Application CRUD operations
  const handleAddApplication = () => {
    // Validation
    let hasError = false;
    
    if (!newAppName.trim()) {
      setAppNameError('Application name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newAppName)) {
      setAppNameError('Application name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if application already exists
      const existingApps = realApplications.length > 0 ? realApplications : (config.applications || []);
      if (existingApps.some(app => app.name === newAppName.trim())) {
        setAppNameError('Application with this name already exists');
        hasError = true;
      } else {
        setAppNameError('');
      }
    }
    
    if (!newAppRepository.trim()) {
      setAppNameError('Repository is required');
      hasError = true;
    } else if (!/^(https?:\/\/|git@)/.test(newAppRepository.trim())) {
      setAppNameError('Repository URL must be a valid Git URL');
      hasError = true;
    }
    
    if (hasError) return;
    
    const newApp: ArgoCDApplication = {
      name: newAppName,
      namespace: newAppNamespace || undefined,
      project: newAppProject || 'default',
      repository: newAppRepository,
      path: newAppPath || '.',
      targetRevision: newAppTargetRevision || 'main',
      destination: {
        server: newAppDestinationServer || 'https://kubernetes.default.svc',
        namespace: newAppDestinationNamespace || 'default',
      },
      syncPolicy: newAppSyncPolicy,
      status: 'progressing',
      health: 'progressing',
    };
    
    // Add to config
    const currentApps = config.applications || [];
    updateConfig({
      applications: [...currentApps, {
        name: newApp.name,
        namespace: newApp.namespace,
        project: newApp.project,
        repository: newApp.repository,
        path: newApp.path,
        targetRevision: newApp.targetRevision,
        destination: newApp.destination,
        syncPolicy: newApp.syncPolicy,
      }],
    });
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addApplication(newApp);
    }
    
    // Reset form
    setNewAppName('');
    setNewAppNamespace('default');
    setNewAppProject('default');
    setNewAppRepository('');
    setNewAppPath('.');
    setNewAppTargetRevision('main');
    setNewAppDestinationServer('https://kubernetes.default.svc');
    setNewAppDestinationNamespace('default');
    setNewAppSyncPolicy('manual');
    setShowAddApplication(false);
    
    toast({
      title: "Application added",
      description: `Application "${newApp.name}" has been added successfully.`,
    });
  };

  const handleEditApplication = (app: ArgoCDApplication) => {
    setEditingApplication(app);
    setNewAppName(app.name);
    setNewAppNamespace(app.namespace || 'default');
    setNewAppProject(app.project || 'default');
    setNewAppRepository(app.repository);
    setNewAppPath(app.path || '.');
    setNewAppTargetRevision(app.targetRevision || 'main');
    setNewAppDestinationServer(app.destination?.server || 'https://kubernetes.default.svc');
    setNewAppDestinationNamespace(app.destination?.namespace || 'default');
    setNewAppSyncPolicy(app.syncPolicy);
    setShowEditApplication(true);
  };

  const handleSaveApplication = () => {
    if (!editingApplication) return;
    
    if (!newAppName.trim()) {
      setAppNameError('Application name is required');
      return;
    }
    
    setAppNameError('');
    
    const updatedApp: ArgoCDApplication = {
      ...editingApplication,
      name: newAppName,
      namespace: newAppNamespace || undefined,
      project: newAppProject || 'default',
      repository: newAppRepository,
      path: newAppPath || '.',
      targetRevision: newAppTargetRevision || 'main',
      destination: {
        server: newAppDestinationServer || 'https://kubernetes.default.svc',
        namespace: newAppDestinationNamespace || 'default',
      },
      syncPolicy: newAppSyncPolicy,
    };
    
    // Update in config
    const currentApps = config.applications || [];
    const updatedApps = currentApps.map(app => 
      app.name === editingApplication.name ? {
        name: updatedApp.name,
        namespace: updatedApp.namespace,
        project: updatedApp.project,
        repository: updatedApp.repository,
        path: updatedApp.path,
        targetRevision: updatedApp.targetRevision,
        destination: updatedApp.destination,
        syncPolicy: updatedApp.syncPolicy,
      } : app
    );
    updateConfig({ applications: updatedApps });
    
    // Update in emulation engine
    if (argoCDEngine) {
      argoCDEngine.updateApplication(editingApplication.name, updatedApp);
    }
    
    setShowEditApplication(false);
    setEditingApplication(null);
    
    toast({
      title: "Application updated",
      description: `Application "${updatedApp.name}" has been updated successfully.`,
    });
  };

  const handleDeleteApplication = (appName: string) => {
    // Remove from config
    const currentApps = config.applications || [];
    updateConfig({
      applications: currentApps.filter(app => app.name !== appName),
    });
    
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeApplication(appName);
    }
    
    toast({
      title: "Application deleted",
      description: `Application "${appName}" has been deleted.`,
    });
  };

  const handleSyncApplication = (appName: string) => {
    if (!argoCDEngine) {
      toast({
        title: "Error",
        description: "Argo CD engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const success = argoCDEngine.startSync(appName);
    if (success) {
      toast({
        title: "Sync started",
        description: `Synchronization for "${appName}" has been started.`,
      });
    } else {
      toast({
        title: "Sync failed",
        description: `Failed to start synchronization for "${appName}".`,
        variant: "destructive",
      });
    }
  };

  // Repository CRUD operations
  const handleAddRepository = () => {
    let hasError = false;
    
    if (!newRepoName.trim()) {
      setRepoNameError('Repository name is required');
      hasError = true;
    } else {
      // Check if repository already exists
      const existingRepos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
      if (existingRepos.some(repo => repo.name === newRepoName.trim())) {
        setRepoNameError('Repository with this name already exists');
        hasError = true;
      } else {
        setRepoNameError('');
      }
    }
    
    if (!newRepoUrl.trim()) {
      setRepoUrlError('Repository URL is required');
      hasError = true;
    } else if (!/^(https?:\/\/|git@|oci:\/\/)/.test(newRepoUrl.trim())) {
      setRepoUrlError('Repository URL must be a valid URL (http/https/git/oci)');
      hasError = true;
    } else {
      setRepoUrlError('');
    }
    
    if (hasError) return;
    
    const newRepo: ArgoCDRepository = {
      name: newRepoName,
      url: newRepoUrl,
      type: newRepoType,
      username: newRepoUsername || undefined,
      password: newRepoPassword || undefined,
      insecure: newRepoInsecure,
      project: newRepoProject || undefined,
      connectionStatus: 'unknown',
    };
    
    // Add to config
    const currentRepos = config.repositories || [];
    updateConfig({
      repositories: [...currentRepos, {
        name: newRepo.name,
        url: newRepo.url,
        type: newRepo.type,
        username: newRepo.username,
        password: newRepo.password,
        insecure: newRepo.insecure,
        project: newRepo.project,
      }],
    });
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addRepository(newRepo);
    }
    
    // Reset form
    setNewRepoName('');
    setNewRepoUrl('');
    setNewRepoType('git');
    setNewRepoUsername('');
    setNewRepoPassword('');
    setNewRepoInsecure(false);
    setNewRepoProject('');
    setShowAddRepository(false);
    
    toast({
      title: "Repository added",
      description: `Repository "${newRepo.name}" has been added successfully.`,
    });
  };

  const handleEditRepository = (repo: ArgoCDRepository) => {
    setEditingRepository(repo);
    setNewRepoName(repo.name);
    setNewRepoUrl(repo.url);
    setNewRepoType(repo.type || 'git');
    setNewRepoUsername(repo.username || '');
    setNewRepoPassword(repo.password || '');
    setNewRepoInsecure(repo.insecure || false);
    setNewRepoProject(repo.project || '');
    setShowEditRepository(true);
  };

  const handleSaveRepository = () => {
    if (!editingRepository) return;
    
    if (!newRepoName.trim()) {
      setRepoNameError('Repository name is required');
      return;
    }
    if (!newRepoUrl.trim()) {
      setRepoUrlError('Repository URL is required');
      return;
    }
    
    setRepoNameError('');
    setRepoUrlError('');
    
    const updatedRepo: ArgoCDRepository = {
      ...editingRepository,
      name: newRepoName,
      url: newRepoUrl,
      type: newRepoType,
      username: newRepoUsername || undefined,
      password: newRepoPassword || undefined,
      insecure: newRepoInsecure,
      project: newRepoProject || undefined,
    };
    
    // Update in config
    const currentRepos = config.repositories || [];
    const updatedRepos = currentRepos.map(repo => 
      repo.name === editingRepository.name ? {
        name: updatedRepo.name,
        url: updatedRepo.url,
        type: updatedRepo.type,
        username: updatedRepo.username,
        password: updatedRepo.password,
        insecure: updatedRepo.insecure,
        project: updatedRepo.project,
      } : repo
    );
    updateConfig({ repositories: updatedRepos });
    
    // Note: Repository update in engine would need to be implemented
    setShowEditRepository(false);
    setEditingRepository(null);
    
    toast({
      title: "Repository updated",
      description: `Repository "${updatedRepo.name}" has been updated successfully.`,
    });
  };

  const handleDeleteRepository = (repoName: string) => {
    // Remove from config
    const currentRepos = config.repositories || [];
    updateConfig({
      repositories: currentRepos.filter(repo => repo.name !== repoName),
    });
    
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeRepository(repoName);
    }
    
    toast({
      title: "Repository deleted",
      description: `Repository "${repoName}" has been deleted.`,
    });
  };

  // Project CRUD operations
  const handleAddProject = () => {
    if (!newProjectName.trim()) {
      setProjectNameError('Project name is required');
      return;
    }
    
    setProjectNameError('');
    
    const newProject: ArgoCDProject = {
      name: newProjectName,
      description: newProjectDescription || undefined,
      sourceRepos: newProjectSourceRepos.length > 0 ? newProjectSourceRepos : ['*'],
      destinations: newProjectDestinations.length > 0 ? newProjectDestinations : [{ server: '*', namespace: '*' }],
    };
    
    // Add to config
    const currentProjects = config.projects || [];
    updateConfig({
      projects: [...currentProjects, {
        name: newProject.name,
        description: newProject.description,
        sourceRepos: newProject.sourceRepos,
        destinations: newProject.destinations,
      }],
    });
    
    // Note: Project add in engine would need to be implemented
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectSourceRepos([]);
    setNewProjectDestinations([]);
    setShowAddProject(false);
    
    toast({
      title: "Project added",
      description: `Project "${newProject.name}" has been added successfully.`,
    });
  };

  const handleDeleteProject = (projectName: string) => {
    // Remove from config
    const currentProjects = config.projects || [];
    updateConfig({
      projects: currentProjects.filter(project => project.name !== projectName),
    });
    
    toast({
      title: "Project deleted",
      description: `Project "${projectName}" has been deleted.`,
    });
  };

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'outofsync':
        return <XCircle className="h-4 w-4 text-yellow-500" />;
      case 'progressing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'degraded':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="destructive">Degraded</Badge>;
      case 'progressing':
        return <Badge variant="default" className="bg-blue-500">Progressing</Badge>;
      case 'suspended':
        return <Badge variant="secondary">Suspended</Badge>;
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>;
      default:
        return <Badge variant="secondary">{health}</Badge>;
    }
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Rocket className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Argo CD</h2>
              <p className="text-sm text-muted-foreground mt-1">
                GitOps Continuous Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
            {componentMetrics && (
              <Badge variant="outline" className="gap-2">
                <Activity className="h-3 w-3" />
                {componentMetrics.throughput?.toFixed(2) || 0} ops/s
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Total apps</p>
              {realMetrics && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stats.healthyApps === stats.totalApps ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span>{stats.healthyApps} healthy</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Synced</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.syncedApps}</div>
              <p className="text-xs text-muted-foreground mt-1">In sync</p>
              {realMetrics && realMetrics.syncOperationsRunning > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>{realMetrics.syncOperationsRunning} syncing</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.outOfSyncApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs sync</p>
              {stats.degradedApps > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  <span>{stats.degradedApps} degraded</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sync Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApps > 0 ? Math.round((stats.syncedApps / stats.totalApps) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">Synced</p>
              {realMetrics && realMetrics.syncRate > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {realMetrics.syncRate} syncs/hour
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        {realMetrics && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stats.repositoriesTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.repositoriesConnected} connected
                  {stats.repositoriesTotal - stats.repositoriesConnected > 0 && (
                    <span className="text-red-500 ml-2">
                      {stats.repositoriesTotal - stats.repositoriesConnected} failed
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stats.projectsTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Total projects</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sync Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{realMetrics.syncOperationsTotal || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {realMetrics.syncOperationsSuccess || 0} success
                  {realMetrics.syncOperationsFailed > 0 && (
                    <span className="text-red-500 ml-2">
                      {realMetrics.syncOperationsFailed} failed
                    </span>
                  )}
                </p>
                {realMetrics.averageSyncDuration > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg duration: {(realMetrics.averageSyncDuration / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="applications" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="applications" className="gap-2">
              <Rocket className="h-4 w-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="repositories" className="gap-2">
              <Database className="h-4 w-4" />
              Repositories
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderGit2 className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="rbac" className="gap-2">
              <Shield className="h-4 w-4" />
              RBAC
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4 mt-4">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search applications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="outofsync">Out of Sync</SelectItem>
                      <SelectItem value="progressing">Progressing</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterHealth} onValueChange={(value: any) => setFilterHealth(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Health</SelectItem>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                      <SelectItem value="progressing">Progressing</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => setShowAddApplication(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    New Application
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Applications List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Applications</CardTitle>
                    <CardDescription>GitOps application deployments ({filteredApplications.length})</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredApplications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No applications found</p>
                      <p className="text-sm mt-2">Create your first application to get started</p>
                    </div>
                  ) : (
                    filteredApplications.map((app, index) => (
                      <Card key={app.name || index} className="border-border hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(app.status)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg">{app.name}</CardTitle>
                                  {getHealthBadge(app.health)}
                                </div>
                                <CardDescription className="text-xs mt-1">
                                  Namespace: {app.namespace || 'default'} • Project: {app.project || 'default'} • {app.syncPolicy} sync
                                  {app.lastSync && ` • Last sync: ${formatTimeAgo(app.lastSync)}`}
                                  {app.revision && ` • Revision: ${app.revision.substring(0, 7)}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {app.status === 'outofsync' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSyncApplication(app.name)}
                                    disabled={app.status === 'progressing'}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Sync
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRefreshApplication(app.name)}
                                  title="Refresh application status"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                {app.history && app.history.length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRollbackApplication(app.name)}
                                    title="Rollback to previous revision"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedApplication(app.name);
                                    setShowApplicationDetails(true);
                                  }}
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditApplication(app)}
                                  title="Edit application"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete application "${app.name}"?`)) {
                                      handleDeleteApplication(app.name);
                                    }
                                  }}
                                  title="Delete application"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Repositories Tab */}
          <TabsContent value="repositories" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Repositories</CardTitle>
                    <CardDescription>Git repositories, Helm charts, and OCI registries</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddRepository(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Repository
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredRepositories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No repositories found</p>
                    </div>
                  ) : (
                    filteredRepositories.map((repo, index) => (
                      <Card key={repo.name || index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <CardTitle className="text-lg">{repo.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {repo.url} • Type: {repo.type || 'git'}
                                  {repo.connectionStatus && (
                                    <Badge 
                                      variant={repo.connectionStatus === 'successful' ? 'default' : 'destructive'}
                                      className="ml-2"
                                    >
                                      {repo.connectionStatus}
                                    </Badge>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRepository(repo)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRepository(repo.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Logical grouping of applications</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddProject(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No projects found</p>
                    </div>
                  ) : (
                    filteredProjects.map((project, index) => (
                      <Card key={project.name || index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                              {project.description && (
                                <CardDescription className="text-xs mt-1">
                                  {project.description}
                                </CardDescription>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProject(project.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Argo CD Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    value={config.serverUrl || 'https://argocd.example.com'}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="https://argocd.example.com"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable SSO</Label>
                      <p className="text-sm text-muted-foreground">Single Sign-On authentication</p>
                    </div>
                    <Switch
                      checked={config.enableSSO ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableSSO: checked })}
                    />
                  </div>
                  {config.enableSSO && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="sso-provider">SSO Provider</Label>
                      <Select
                        value={config.ssoProvider || 'oidc'}
                        onValueChange={(value: 'oidc' | 'saml' | 'ldap') => updateConfig({ ssoProvider: value })}
                      >
                        <SelectTrigger id="sso-provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oidc">OIDC</SelectItem>
                          <SelectItem value="saml">SAML</SelectItem>
                          <SelectItem value="ldap">LDAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable RBAC</Label>
                      <p className="text-sm text-muted-foreground">Role-based access control</p>
                    </div>
                    <Switch
                      checked={config.enableRBAC ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableRBAC: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Sync</Label>
                      <p className="text-sm text-muted-foreground">Automatically sync applications</p>
                    </div>
                    <Switch
                      checked={config.autoSync ?? false}
                      onCheckedChange={(checked) => updateConfig({ autoSync: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Health Checks</Label>
                      <p className="text-sm text-muted-foreground">Monitor application health</p>
                    </div>
                    <Switch
                      checked={config.enableHealthChecks ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableHealthChecks: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sync Status</span>
                      <span className="font-semibold">{stats.syncedApps}/{stats.totalApps} synced</span>
                    </div>
                    <Progress value={stats.totalApps > 0 ? (stats.syncedApps / stats.totalApps) * 100 : 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RBAC Tab */}
          <TabsContent value="rbac" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Role-Based Access Control</CardTitle>
                <CardDescription>Manage roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>RBAC configuration coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure notification channels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send notifications for sync events</p>
                  </div>
                  <Switch
                    checked={config.enableNotifications ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableNotifications: checked })}
                  />
                </div>
                {config.enableNotifications && (
                  <div className="space-y-2">
                    <Label>Notification Channels</Label>
                    <div className="flex flex-wrap gap-2">
                      {(config.notificationChannels || ['slack']).map((channel, index) => (
                        <Badge key={index} variant="secondary">
                          {channel}
                          <button
                            onClick={() => {
                              const channels = config.notificationChannels || [];
                              updateConfig({
                                notificationChannels: channels.filter((_, i) => i !== index),
                              });
                            }}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Channel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Application Dialog */}
      <Dialog open={showAddApplication} onOpenChange={setShowAddApplication}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Application</DialogTitle>
            <DialogDescription>
              Create a new Argo CD application for GitOps deployment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">Application Name *</Label>
              <Input
                id="app-name"
                value={newAppName}
                onChange={(e) => {
                  setNewAppName(e.target.value);
                  setAppNameError('');
                }}
                placeholder="my-app"
              />
              {appNameError && <p className="text-sm text-destructive">{appNameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-namespace">Namespace</Label>
                <Input
                  id="app-namespace"
                  value={newAppNamespace}
                  onChange={(e) => setNewAppNamespace(e.target.value)}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-project">Project</Label>
                <Input
                  id="app-project"
                  value={newAppProject}
                  onChange={(e) => setNewAppProject(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-repository">Repository *</Label>
              <Input
                id="app-repository"
                value={newAppRepository}
                onChange={(e) => {
                  setNewAppRepository(e.target.value);
                  setAppNameError('');
                }}
                placeholder="https://github.com/example/repo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-path">Path</Label>
                <Input
                  id="app-path"
                  value={newAppPath}
                  onChange={(e) => setNewAppPath(e.target.value)}
                  placeholder="."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-revision">Target Revision</Label>
                <Input
                  id="app-revision"
                  value={newAppTargetRevision}
                  onChange={(e) => setNewAppTargetRevision(e.target.value)}
                  placeholder="main"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-dest-server">Destination Server</Label>
                <Input
                  id="app-dest-server"
                  value={newAppDestinationServer}
                  onChange={(e) => setNewAppDestinationServer(e.target.value)}
                  placeholder="https://kubernetes.default.svc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-dest-namespace">Destination Namespace</Label>
                <Input
                  id="app-dest-namespace"
                  value={newAppDestinationNamespace}
                  onChange={(e) => setNewAppDestinationNamespace(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-sync-policy">Sync Policy</Label>
              <Select
                value={newAppSyncPolicy}
                onValueChange={(value: 'automated' | 'manual' | 'sync-window') => setNewAppSyncPolicy(value)}
              >
                <SelectTrigger id="app-sync-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automated">Automated</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="sync-window">Sync Window</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddApplication(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddApplication}>
              Create Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Application Dialog */}
      <Dialog open={showEditApplication} onOpenChange={setShowEditApplication}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Application</DialogTitle>
            <DialogDescription>
              Update application configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-app-name">Application Name *</Label>
              <Input
                id="edit-app-name"
                value={newAppName}
                onChange={(e) => {
                  setNewAppName(e.target.value);
                  setAppNameError('');
                }}
                placeholder="my-app"
              />
              {appNameError && <p className="text-sm text-destructive">{appNameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-app-namespace">Namespace</Label>
                <Input
                  id="edit-app-namespace"
                  value={newAppNamespace}
                  onChange={(e) => setNewAppNamespace(e.target.value)}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-app-project">Project</Label>
                <Input
                  id="edit-app-project"
                  value={newAppProject}
                  onChange={(e) => setNewAppProject(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-app-repository">Repository *</Label>
              <Input
                id="edit-app-repository"
                value={newAppRepository}
                onChange={(e) => {
                  setNewAppRepository(e.target.value);
                  setAppNameError('');
                }}
                placeholder="https://github.com/example/repo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-app-path">Path</Label>
                <Input
                  id="edit-app-path"
                  value={newAppPath}
                  onChange={(e) => setNewAppPath(e.target.value)}
                  placeholder="."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-app-revision">Target Revision</Label>
                <Input
                  id="edit-app-revision"
                  value={newAppTargetRevision}
                  onChange={(e) => setNewAppTargetRevision(e.target.value)}
                  placeholder="main"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-app-dest-server">Destination Server</Label>
                <Input
                  id="edit-app-dest-server"
                  value={newAppDestinationServer}
                  onChange={(e) => setNewAppDestinationServer(e.target.value)}
                  placeholder="https://kubernetes.default.svc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-app-dest-namespace">Destination Namespace</Label>
                <Input
                  id="edit-app-dest-namespace"
                  value={newAppDestinationNamespace}
                  onChange={(e) => setNewAppDestinationNamespace(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-app-sync-policy">Sync Policy</Label>
              <Select
                value={newAppSyncPolicy}
                onValueChange={(value: 'automated' | 'manual' | 'sync-window') => setNewAppSyncPolicy(value)}
              >
                <SelectTrigger id="edit-app-sync-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automated">Automated</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="sync-window">Sync Window</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditApplication(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApplication}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Repository Dialog */}
      <Dialog open={showAddRepository} onOpenChange={setShowAddRepository}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Add a Git repository, Helm chart repository, or OCI registry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-name">Repository Name *</Label>
              <Input
                id="repo-name"
                value={newRepoName}
                onChange={(e) => {
                  setNewRepoName(e.target.value);
                  setRepoNameError('');
                }}
                placeholder="my-repo"
              />
              {repoNameError && <p className="text-sm text-destructive">{repoNameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL *</Label>
              <Input
                id="repo-url"
                value={newRepoUrl}
                onChange={(e) => {
                  setNewRepoUrl(e.target.value);
                  setRepoUrlError('');
                }}
                placeholder="https://github.com/example/repo"
              />
              {repoUrlError && <p className="text-sm text-destructive">{repoUrlError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo-type">Repository Type</Label>
              <Select
                value={newRepoType}
                onValueChange={(value: 'git' | 'helm' | 'oci') => setNewRepoType(value)}
              >
                <SelectTrigger id="repo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git</SelectItem>
                  <SelectItem value="helm">Helm</SelectItem>
                  <SelectItem value="oci">OCI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="repo-username">Username</Label>
                <Input
                  id="repo-username"
                  value={newRepoUsername}
                  onChange={(e) => setNewRepoUsername(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo-password">Password</Label>
                <Input
                  id="repo-password"
                  type="password"
                  value={newRepoPassword}
                  onChange={(e) => setNewRepoPassword(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="repo-insecure"
                checked={newRepoInsecure}
                onCheckedChange={setNewRepoInsecure}
              />
              <Label htmlFor="repo-insecure">Insecure (skip TLS verification)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRepository(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRepository}>
              Add Repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Repository Dialog */}
      <Dialog open={showEditRepository} onOpenChange={setShowEditRepository}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Repository</DialogTitle>
            <DialogDescription>
              Update repository configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-repo-name">Repository Name *</Label>
              <Input
                id="edit-repo-name"
                value={newRepoName}
                onChange={(e) => {
                  setNewRepoName(e.target.value);
                  setRepoNameError('');
                }}
                placeholder="my-repo"
              />
              {repoNameError && <p className="text-sm text-destructive">{repoNameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-repo-url">Repository URL *</Label>
              <Input
                id="edit-repo-url"
                value={newRepoUrl}
                onChange={(e) => {
                  setNewRepoUrl(e.target.value);
                  setRepoUrlError('');
                }}
                placeholder="https://github.com/example/repo"
              />
              {repoUrlError && <p className="text-sm text-destructive">{repoUrlError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-repo-type">Repository Type</Label>
              <Select
                value={newRepoType}
                onValueChange={(value: 'git' | 'helm' | 'oci') => setNewRepoType(value)}
              >
                <SelectTrigger id="edit-repo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git</SelectItem>
                  <SelectItem value="helm">Helm</SelectItem>
                  <SelectItem value="oci">OCI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-repo-username">Username</Label>
                <Input
                  id="edit-repo-username"
                  value={newRepoUsername}
                  onChange={(e) => setNewRepoUsername(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-repo-password">Password</Label>
                <Input
                  id="edit-repo-password"
                  type="password"
                  value={newRepoPassword}
                  onChange={(e) => setNewRepoPassword(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-repo-insecure"
                checked={newRepoInsecure}
                onCheckedChange={setNewRepoInsecure}
              />
              <Label htmlFor="edit-repo-insecure">Insecure (skip TLS verification)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRepository(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRepository}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog */}
      <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a new project to group applications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  setProjectNameError('');
                }}
                placeholder="my-project"
              />
              {projectNameError && <p className="text-sm text-destructive">{projectNameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Project description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProject(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Details Dialog */}
      <Dialog open={showApplicationDetails} onOpenChange={setShowApplicationDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Detailed information about application
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (() => {
            const app = realApplications.find(a => a.name === selectedApplication) || 
                       (config.applications || []).find((a: any) => a.name === selectedApplication);
            if (!app) return null;
            
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-semibold">{app.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(app.status)}
                      <span className="capitalize">{app.status}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Health</Label>
                    <div>{getHealthBadge(app.health)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Namespace</Label>
                    <p>{app.namespace || 'default'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Project</Label>
                    <p>{app.project || 'default'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sync Policy</Label>
                    <p className="capitalize">{app.syncPolicy}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Repository</Label>
                    <p className="text-sm break-all">{app.repository}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Path</Label>
                    <p>{app.path || '.'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Target Revision</Label>
                    <p>{app.targetRevision || 'main'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Current Revision</Label>
                    <p className="font-mono text-sm">{app.revision || 'N/A'}</p>
                  </div>
                  {app.lastSync && (
                    <div>
                      <Label className="text-muted-foreground">Last Sync</Label>
                      <p>{formatTimeAgo(app.lastSync)}</p>
                      {app.lastSyncDuration && (
                        <p className="text-xs text-muted-foreground">
                          Duration: {(app.lastSyncDuration / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  )}
                  {app.destination && (
                    <>
                      <div>
                        <Label className="text-muted-foreground">Destination Server</Label>
                        <p className="text-sm break-all">{app.destination.server || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Destination Namespace</Label>
                        <p>{app.destination.namespace || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>
                
                {app.history && app.history.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Sync History</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {app.history.map((entry, index) => (
                          <div key={entry.id || index} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono text-sm">{entry.revision.substring(0, 7)}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(entry.deployedAt)}
                              </span>
                            </div>
                            {index === 0 && (
                              <Badge variant="secondary" className="text-xs">Current</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {realSyncOperations.filter(op => op.application === app.name).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Active Sync Operations</Label>
                      <div className="space-y-2">
                        {realSyncOperations
                          .filter(op => op.application === app.name && op.status === 'running')
                          .map(op => (
                            <div key={op.id} className="flex items-center gap-2 p-2 border rounded">
                              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                              <span className="text-sm">Sync in progress...</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                Started {formatTimeAgo(op.startedAt)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplicationDetails(false)}>
              Close
            </Button>
            {selectedApplication && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedApplication) {
                      handleRefreshApplication(selectedApplication);
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={() => {
                    if (selectedApplication) {
                      handleSyncApplication(selectedApplication);
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
