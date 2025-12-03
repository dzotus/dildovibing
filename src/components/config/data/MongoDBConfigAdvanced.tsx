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
  Database,
  FileText,
  Search,
  Settings,
  Plus,
  Trash2,
  Edit,
  Network,
  Copy,
  Filter
} from 'lucide-react';

interface MongoDBConfigProps {
  componentId: string;
}

interface Collection {
  name: string;
  database: string;
  documentCount?: number;
  size?: number;
  indexes?: Index[];
  validation?: SchemaValidation;
}

interface Index {
  name: string;
  keys: Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

interface SchemaValidation {
  validator: Record<string, any>;
  validationLevel?: 'off' | 'strict' | 'moderate';
  validationAction?: 'error' | 'warn';
}

interface Document {
  _id: string;
  [key: string]: any;
}

interface AggregationStage {
  stage: string;
  expression: string;
}

interface ShardConfig {
  shardKey: Record<string, 1 | -1 | 'hashed'>;
  shards: string[];
}

interface ReplicaSetMember {
  host: string;
  port: number;
  priority?: number;
  votes?: number;
  arbiterOnly?: boolean;
}

interface MongoDBConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  authSource?: string;
  enableReplicaSet?: boolean;
  replicaSetName?: string;
  replicaSetMembers?: ReplicaSetMember[];
  enableSharding?: boolean;
  shardConfig?: ShardConfig;
  collections?: Collection[];
  selectedCollection?: string;
  selectedDatabase?: string;
  documents?: Document[];
  aggregationPipeline?: AggregationStage[];
}

export function MongoDBConfigAdvanced({ componentId }: MongoDBConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as MongoDBConfig;
  const host = config.host || 'localhost';
  const port = config.port || 27017;
  const database = config.database || 'test';
  const username = config.username || 'admin';
  const password = config.password || '';
  const authSource = config.authSource || 'admin';
  const enableReplicaSet = config.enableReplicaSet ?? false;
  const replicaSetName = config.replicaSetName || 'rs0';
  const replicaSetMembers = config.replicaSetMembers || [
    { host: 'localhost', port: 27017, priority: 1, votes: 1 },
    { host: 'localhost', port: 27018, priority: 1, votes: 1 },
    { host: 'localhost', port: 27019, priority: 0, votes: 0, arbiterOnly: true }
  ];
  const enableSharding = config.enableSharding ?? false;
  const shardConfig = config.shardConfig || { shardKey: { _id: 'hashed' }, shards: ['shard1', 'shard2'] };
  const collections = config.collections || [];
  const selectedDatabase = config.selectedDatabase || database;
  const selectedCollection = config.selectedCollection || '';
  const documents = config.documents || [];
  const aggregationPipeline = config.aggregationPipeline || [];

  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [editingCollectionIndex, setEditingCollectionIndex] = useState<number | null>(null);
  const [showCreateIndex, setShowCreateIndex] = useState(false);
  const [selectedCollectionForIndex, setSelectedCollectionForIndex] = useState<string | null>(null);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [newDocument, setNewDocument] = useState<string>('{}');
  const [queryFilter, setQueryFilter] = useState<string>('{}');
  const [showAggregationBuilder, setShowAggregationBuilder] = useState(false);

  const updateConfig = (updates: Partial<MongoDBConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addCollection = () => {
    const newCollection: Collection = {
      name: 'new_collection',
      database: selectedDatabase,
      documentCount: 0,
      size: 0,
      indexes: [{ name: '_id_', keys: { _id: 1 }, unique: true }],
    };
    updateConfig({ collections: [...collections, newCollection] });
    setShowCreateCollection(false);
  };

  const removeCollection = (index: number) => {
    updateConfig({ collections: collections.filter((_, i) => i !== index) });
  };

  const updateCollection = (index: number, field: keyof Collection, value: any) => {
    const updated = [...collections];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ collections: updated });
  };

  const addIndex = (collectionName: string) => {
    const collectionIndex = collections.findIndex(c => c.name === collectionName);
    if (collectionIndex === -1) return;

    const newIndex: Index = {
      name: `index_${Date.now()}`,
      keys: { field: 1 },
      unique: false,
      sparse: false,
      background: false
    };

    const updated = [...collections];
    if (!updated[collectionIndex].indexes) {
      updated[collectionIndex].indexes = [];
    }
    updated[collectionIndex].indexes = [...updated[collectionIndex].indexes!, newIndex];
    updateConfig({ collections: updated });
    setShowCreateIndex(false);
    setSelectedCollectionForIndex(null);
  };

  const removeIndex = (collectionName: string, indexName: string) => {
    const collectionIndex = collections.findIndex(c => c.name === collectionName);
    if (collectionIndex === -1) return;

    const updated = [...collections];
    updated[collectionIndex].indexes = updated[collectionIndex].indexes?.filter(idx => idx.name !== indexName);
    updateConfig({ collections: updated });
  };

  const addReplicaSetMember = () => {
    updateConfig({
      replicaSetMembers: [...replicaSetMembers, { host: 'localhost', port: 27020, priority: 1, votes: 1 }]
    });
  };

  const removeReplicaSetMember = (index: number) => {
    updateConfig({ replicaSetMembers: replicaSetMembers.filter((_, i) => i !== index) });
  };

  const addShard = () => {
    updateConfig({
      shardConfig: {
        ...shardConfig,
        shards: [...shardConfig.shards, `shard${shardConfig.shards.length + 1}`]
      }
    });
  };

  const addAggregationStage = () => {
    const newStage: AggregationStage = {
      stage: '$match',
      expression: '{}'
    };
    updateConfig({ aggregationPipeline: [...aggregationPipeline, newStage] });
  };

  const removeAggregationStage = (index: number) => {
    updateConfig({ aggregationPipeline: aggregationPipeline.filter((_, i) => i !== index) });
  };

  const updateAggregationStage = (index: number, field: keyof AggregationStage, value: string) => {
    const updated = [...aggregationPipeline];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ aggregationPipeline: updated });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">MongoDB</h2>
              <p className="text-sm text-muted-foreground mt-1">Document database management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v7.0</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure MongoDB connection parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={host}
                onChange={(e) => updateConfig({ host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 27017 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input
                value={database}
                onChange={(e) => updateConfig({ database: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => updateConfig({ username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => updateConfig({ password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Source</Label>
              <Input
                value={authSource}
                onChange={(e) => updateConfig({ authSource: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="collections" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="collections" className="gap-2">
              <FileText className="h-4 w-4" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <Database className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="aggregations" className="gap-2">
              <Filter className="h-4 w-4" />
              Aggregations
            </TabsTrigger>
            <TabsTrigger value="replication" className="gap-2">
              <Copy className="h-4 w-4" />
              Replication
            </TabsTrigger>
            <TabsTrigger value="sharding" className="gap-2">
              <Network className="h-4 w-4" />
              Sharding
            </TabsTrigger>
          </TabsList>

          {/* Collections Tab */}
          <TabsContent value="collections" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Collections</CardTitle>
                  <CardDescription>Manage database collections and indexes</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateCollection(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Collection
                </Button>
              </CardHeader>
              {showCreateCollection && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Collection Name</Label>
                      <Input placeholder="new_collection" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addCollection}>Create Collection</Button>
                      <Button variant="outline" onClick={() => setShowCreateCollection(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {collections.map((collection, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{collection.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {collection.documentCount || 0} documents • {collection.size || 0} MB
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCollectionIndex(editingCollectionIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingCollectionIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeCollection(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {editingCollectionIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        {/* Indexes */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Indexes</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCollectionForIndex(collection.name);
                                setShowCreateIndex(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Index
                            </Button>
                          </div>
                          {collection.indexes && collection.indexes.length > 0 && (
                            <div className="space-y-2">
                              {collection.indexes.map((idx, idxIndex) => (
                                <div key={idxIndex} className="p-2 border rounded bg-muted/50 flex items-center justify-between">
                                  <div className="space-y-1">
                                    <div className="font-mono text-sm">{idx.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {Object.entries(idx.keys).map(([key, value]) => `${key}: ${value}`).join(', ')}
                                      {idx.unique && ' • unique'}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeIndex(collection.name, idx.name)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Schema Validation */}
                        <div className="space-y-2">
                          <Label>Schema Validation</Label>
                          <Textarea
                            className="font-mono text-xs"
                            rows={4}
                            value={collection.validation ? JSON.stringify(collection.validation.validator, null, 2) : '{}'}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                updateCollection(index, 'validation', {
                                  validator: parsed,
                                  validationLevel: collection.validation?.validationLevel || 'strict',
                                  validationAction: collection.validation?.validationAction || 'error'
                                });
                              } catch {}
                            }}
                            placeholder='{"$jsonSchema": {"required": ["field"]}}'
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>View and manage collection documents</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedCollection} onValueChange={(value) => updateConfig({ selectedCollection: value })}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col, idx) => (
                        <SelectItem key={idx} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateDocument(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Insert Document
                  </Button>
                </div>
              </CardHeader>
              {showCreateDocument && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Document (JSON)</Label>
                      <Textarea
                        className="font-mono text-sm"
                        rows={6}
                        value={newDocument}
                        onChange={(e) => setNewDocument(e.target.value)}
                        placeholder='{"name": "John", "email": "john@example.com"}'
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => {
                        try {
                          const parsed = JSON.parse(newDocument);
                          const doc: Document = { _id: `doc_${Date.now()}`, ...parsed };
                          updateConfig({ documents: [...documents, doc] });
                          setNewDocument('{}');
                          setShowCreateDocument(false);
                        } catch (e) {
                          alert('Invalid JSON');
                        }
                      }}>Insert Document</Button>
                      <Button variant="outline" onClick={() => setShowCreateDocument(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Query Filter (JSON)</Label>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono text-sm"
                      value={queryFilter}
                      onChange={(e) => setQueryFilter(e.target.value)}
                      placeholder='{"status": "active"}'
                    />
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Find
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {documents.length > 0 ? (
                    documents.map((doc, idx) => (
                      <div key={idx} className="p-3 border rounded bg-muted/50 font-mono text-xs">
                        <pre>{JSON.stringify(doc, null, 2)}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No documents found. Insert a document to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aggregations Tab */}
          <TabsContent value="aggregations" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Aggregation Pipeline</CardTitle>
                  <CardDescription>Build MongoDB aggregation pipelines</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addAggregationStage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {aggregationPipeline.map((stage, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Select
                          value={stage.stage}
                          onValueChange={(value) => updateAggregationStage(index, 'stage', value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="$match">$match</SelectItem>
                            <SelectItem value="$group">$group</SelectItem>
                            <SelectItem value="$project">$project</SelectItem>
                            <SelectItem value="$sort">$sort</SelectItem>
                            <SelectItem value="$limit">$limit</SelectItem>
                            <SelectItem value="$skip">$skip</SelectItem>
                            <SelectItem value="$unwind">$unwind</SelectItem>
                            <SelectItem value="$lookup">$lookup</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">Stage Type</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeAggregationStage(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Expression (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={3}
                        value={stage.expression}
                        onChange={(e) => updateAggregationStage(index, 'expression', e.target.value)}
                        placeholder='{"status": "active"}'
                      />
                    </div>
                  </div>
                ))}
                {aggregationPipeline.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No aggregation stages. Add a stage to build your pipeline.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Replication Tab */}
          <TabsContent value="replication" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Replica Set Configuration</CardTitle>
                <CardDescription>Configure MongoDB replica set members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Replica Set</Label>
                    <p className="text-sm text-muted-foreground">Enable MongoDB replica set for high availability</p>
                  </div>
                  <Switch
                    checked={enableReplicaSet}
                    onCheckedChange={(checked) => updateConfig({ enableReplicaSet: checked })}
                  />
                </div>
                {enableReplicaSet && (
                  <>
                    <div className="space-y-2">
                      <Label>Replica Set Name</Label>
                      <Input
                        value={replicaSetName}
                        onChange={(e) => updateConfig({ replicaSetName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Replica Set Members</Label>
                        <Button variant="outline" size="sm" onClick={addReplicaSetMember}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </div>
                      {replicaSetMembers.map((member, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="grid grid-cols-4 gap-4 flex-1">
                              <div className="space-y-2">
                                <Label>Host</Label>
                                <Input
                                  value={member.host}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], host: e.target.value };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Port</Label>
                                <Input
                                  type="number"
                                  value={member.port}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], port: parseInt(e.target.value) || 27017 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Priority</Label>
                                <Input
                                  type="number"
                                  value={member.priority || 1}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], priority: parseInt(e.target.value) || 1 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Votes</Label>
                                <Input
                                  type="number"
                                  value={member.votes || 1}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], votes: parseInt(e.target.value) || 1 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeReplicaSetMember(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={member.arbiterOnly || false}
                              onCheckedChange={(checked) => {
                                const updated = [...replicaSetMembers];
                                updated[index] = { ...updated[index], arbiterOnly: checked };
                                updateConfig({ replicaSetMembers: updated });
                              }}
                            />
                            <Label>Arbiter Only</Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sharding Tab */}
          <TabsContent value="sharding" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sharding Configuration</CardTitle>
                <CardDescription>Configure MongoDB sharding for horizontal scaling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Sharding</Label>
                    <p className="text-sm text-muted-foreground">Enable sharding for distributed data storage</p>
                  </div>
                  <Switch
                    checked={enableSharding}
                    onCheckedChange={(checked) => updateConfig({ enableSharding: checked })}
                  />
                </div>
                {enableSharding && (
                  <>
                    <div className="space-y-2">
                      <Label>Shard Key (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={3}
                        value={JSON.stringify(shardConfig.shardKey, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateConfig({ shardConfig: { ...shardConfig, shardKey: parsed } });
                          } catch {}
                        }}
                        placeholder='{"_id": "hashed"}'
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Shards</Label>
                        <Button variant="outline" size="sm" onClick={addShard}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Shard
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {shardConfig.shards.map((shard, index) => (
                          <div key={index} className="p-3 border rounded bg-muted/50 flex items-center justify-between">
                            <span className="font-mono">{shard}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                updateConfig({
                                  shardConfig: {
                                    ...shardConfig,
                                    shards: shardConfig.shards.filter((_, i) => i !== index)
                                  }
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

