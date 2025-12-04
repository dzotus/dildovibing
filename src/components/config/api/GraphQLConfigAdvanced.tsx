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
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  Database,
  Zap,
  Search
} from 'lucide-react';

interface GraphQLConfigProps {
  componentId: string;
}

interface Query {
  id: string;
  name: string;
  query: string;
  variables?: string;
  timestamp: string;
  duration?: number;
  success?: boolean;
}

interface Type {
  name: string;
  kind: 'OBJECT' | 'SCALAR' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT';
  fields?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  description?: string;
}

interface GraphQLConfig {
  queries?: Query[];
  schema?: {
    types?: Type[];
    queries?: Type[];
    mutations?: Type[];
  };
  endpoint?: string;
  subscriptionsEnabled?: boolean;
  introspectionEnabled?: boolean;
  totalQueries?: number;
  averageResponseTime?: number;
}

export function GraphQLConfigAdvanced({ componentId }: GraphQLConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GraphQLConfig;
  const queries = config.queries || [];
  const schema = config.schema || {
    types: [
      {
        name: 'User',
        kind: 'OBJECT',
        fields: [
          { name: 'id', type: 'ID!', description: 'User unique identifier' },
          { name: 'name', type: 'String!', description: 'User name' },
          { name: 'email', type: 'String!', description: 'User email' },
          { name: 'posts', type: '[Post!]!', description: 'User posts' },
        ],
        description: 'User type',
      },
      {
        name: 'Post',
        kind: 'OBJECT',
        fields: [
          { name: 'id', type: 'ID!', description: 'Post unique identifier' },
          { name: 'title', type: 'String!', description: 'Post title' },
          { name: 'content', type: 'String', description: 'Post content' },
          { name: 'author', type: 'User!', description: 'Post author' },
        ],
        description: 'Post type',
      },
    ],
    queries: [
      {
        name: 'Query',
        kind: 'OBJECT',
        fields: [
          { name: 'users', type: '[User!]!', description: 'Get all users' },
          { name: 'user', type: 'User', description: 'Get user by ID' },
          { name: 'posts', type: '[Post!]!', description: 'Get all posts' },
        ],
      },
    ],
    mutations: [
      {
        name: 'Mutation',
        kind: 'OBJECT',
        fields: [
          { name: 'createUser', type: 'User!', description: 'Create a new user' },
          { name: 'updateUser', type: 'User!', description: 'Update user' },
          { name: 'deleteUser', type: 'Boolean!', description: 'Delete user' },
        ],
      },
    ],
  };
  const endpoint = config.endpoint || '/graphql';
  const subscriptionsEnabled = config.subscriptionsEnabled ?? true;
  const introspectionEnabled = config.introspectionEnabled ?? true;
  const totalQueries = config.totalQueries || queries.length;
  const averageResponseTime = config.averageResponseTime || queries.reduce((sum, q) => sum + (q.duration || 0), 0) / queries.length;

  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [queryText, setQueryText] = useState(`query {
  users {
    id
    name
  }
}`);
  const [variablesText, setVariablesText] = useState('');
  const [responseText, setResponseText] = useState('');

  const updateConfig = (updates: Partial<GraphQLConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const executeQuery = () => {
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      name: 'New Query',
      query: queryText,
      variables: variablesText || undefined,
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 100) + 20,
      success: true,
    };
    setResponseText(JSON.stringify({ data: { users: [{ id: '1', name: 'John Doe' }] } }, null, 2));
    updateConfig({ queries: [...queries, newQuery] });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">GraphQL</p>
            <h2 className="text-2xl font-bold text-foreground">GraphQL API</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Query language and runtime for APIs
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
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Queries</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalQueries}</span>
                <span className="text-xs text-muted-foreground">executed</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response</CardTitle>
                <Zap className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{averageResponseTime.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Types</CardTitle>
                <Database className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{schema.types?.length || 0}</span>
                <span className="text-xs text-muted-foreground">defined</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endpoint</CardTitle>
                <Code className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 truncate">{endpoint}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="playground" className="space-y-4">
          <TabsList>
            <TabsTrigger value="playground">
              <Play className="h-4 w-4 mr-2" />
              Playground
            </TabsTrigger>
            <TabsTrigger value="schema">
              <FileText className="h-4 w-4 mr-2" />
              Schema Explorer
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Query History ({queries.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GraphQL Playground</CardTitle>
                <CardDescription>Execute queries and mutations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Query</Label>
                    <Textarea
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="font-mono text-sm min-h-[300px]"
                      placeholder="query { ... }"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Variables (JSON)</Label>
                    <Textarea
                      value={variablesText}
                      onChange={(e) => setVariablesText(e.target.value)}
                      className="font-mono text-sm min-h-[150px]"
                      placeholder='{ "id": "1" }'
                    />
                    <Label>Response</Label>
                    <Textarea
                      value={responseText}
                      readOnly
                      className="font-mono text-sm min-h-[150px] bg-muted"
                      placeholder="Response will appear here..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={executeQuery}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Query
                  </Button>
                  <Button variant="outline" onClick={() => { setQueryText(''); setVariablesText(''); setResponseText(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Schema Explorer</CardTitle>
                <CardDescription>Browse GraphQL schema types and fields</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {schema.types?.map((type) => (
                    <Card key={type.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{type.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{type.kind}</Badge>
                              {type.description && (
                                <span className="text-sm text-muted-foreground">{type.description}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      {type.fields && type.fields.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            <Label>Fields</Label>
                            {type.fields.map((field) => (
                              <div key={field.name} className="p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{field.name}</span>
                                  <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                </div>
                                {field.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Query History</CardTitle>
                <CardDescription>Previously executed queries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queries.map((query) => (
                    <Card key={query.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${query.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {query.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{query.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {query.duration && (
                                  <Badge variant="outline">{query.duration}ms</Badge>
                                )}
                                <Badge variant={query.success ? 'default' : 'destructive'}>
                                  {query.success ? 'Success' : 'Failed'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Query</Label>
                          <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{query.query}</pre>
                          {query.variables && (
                            <>
                              <Label>Variables</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{query.variables}</pre>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(query.timestamp).toLocaleString()}
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
                <CardTitle>GraphQL Settings</CardTitle>
                <CardDescription>API configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="/graphql"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Subscriptions</Label>
                  <Switch
                    checked={subscriptionsEnabled}
                    onCheckedChange={(checked) => updateConfig({ subscriptionsEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Introspection</Label>
                  <Switch
                    checked={introspectionEnabled}
                    onCheckedChange={(checked) => updateConfig({ introspectionEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Query Complexity Analysis</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Query Depth Limiting</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Query Depth</Label>
                  <Input type="number" defaultValue={15} min={1} max={50} />
                </div>
                <div className="space-y-2">
                  <Label>Max Query Complexity</Label>
                  <Input type="number" defaultValue={1000} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

