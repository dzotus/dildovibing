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
import { Plus, Trash2, Database, Table, Eye, Settings, Key } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
}

interface Index {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'gin' | 'gist';
}

interface Table {
  id: string;
  name: string;
  schema: string;
  columns: Column[];
  indexes: Index[];
}

interface View {
  id: string;
  name: string;
  query: string;
  description?: string;
}

interface PostgreSQLConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslMode?: string;
  tables?: Table[];
  views?: View[];
  maxConnections?: number;
  poolSize?: number;
}

export function PostgreSQLConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('tables');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PostgreSQLConfig;
  const tables = config.tables || [];
  const views = config.views || [];

  const updateConfig = (updates: Partial<PostgreSQLConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addTable = () => {
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: 'new_table',
      schema: 'public',
      columns: [],
      indexes: [],
    };
    updateConfig({ tables: [...tables, newTable] });
  };

  const updateTable = (index: number, updates: Partial<Table>) => {
    const updated = [...tables];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ tables: updated });
  };

  const removeTable = (index: number) => {
    updateConfig({ tables: tables.filter((_, i) => i !== index) });
  };

  const addColumn = (tableIndex: number) => {
    const table = tables[tableIndex];
    const newColumn: Column = {
      id: `column-${Date.now()}`,
      name: 'new_column',
      type: 'VARCHAR(255)',
      nullable: true,
      primaryKey: false,
      unique: false,
    };
    updateTable(tableIndex, {
      columns: [...(table.columns || []), newColumn],
    });
  };

  const updateColumn = (tableIndex: number, columnIndex: number, updates: Partial<Column>) => {
    const table = tables[tableIndex];
    const updatedColumns = [...(table.columns || [])];
    updatedColumns[columnIndex] = { ...updatedColumns[columnIndex], ...updates };
    updateTable(tableIndex, { columns: updatedColumns });
  };

  const removeColumn = (tableIndex: number, columnIndex: number) => {
    const table = tables[tableIndex];
    updateTable(tableIndex, {
      columns: (table.columns || []).filter((_, i) => i !== columnIndex),
    });
  };

  const addIndex = (tableIndex: number) => {
    const table = tables[tableIndex];
    const newIndex: Index = {
      id: `index-${Date.now()}`,
      name: `idx_${table.name}`,
      columns: [],
      unique: false,
      type: 'btree',
    };
    updateTable(tableIndex, {
      indexes: [...(table.indexes || []), newIndex],
    });
  };

  const updateIndex = (tableIndex: number, indexIndex: number, updates: Partial<Index>) => {
    const table = tables[tableIndex];
    const updatedIndexes = [...(table.indexes || [])];
    updatedIndexes[indexIndex] = { ...updatedIndexes[indexIndex], ...updates };
    updateTable(tableIndex, { indexes: updatedIndexes });
  };

  const removeIndex = (tableIndex: number, indexIndex: number) => {
    const table = tables[tableIndex];
    updateTable(tableIndex, {
      indexes: (table.indexes || []).filter((_, i) => i !== indexIndex),
    });
  };

  const addView = () => {
    const newView: View = {
      id: `view-${Date.now()}`,
      name: 'new_view',
      query: 'SELECT * FROM table_name',
    };
    updateConfig({ views: [...views, newView] });
  };

  const updateView = (index: number, updates: Partial<View>) => {
    const updated = [...views];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ views: updated });
  };

  const removeView = (index: number) => {
    updateConfig({ views: views.filter((_, i) => i !== index) });
  };

  const columnTypes = [
    'SERIAL',
    'BIGSERIAL',
    'INTEGER',
    'BIGINT',
    'SMALLINT',
    'DECIMAL(p,s)',
    'NUMERIC(p,s)',
    'REAL',
    'DOUBLE PRECISION',
    'VARCHAR(n)',
    'CHAR(n)',
    'TEXT',
    'BOOLEAN',
    'DATE',
    'TIME',
    'TIMESTAMP',
    'TIMESTAMPTZ',
    'JSON',
    'JSONB',
    'UUID',
    'BYTEA',
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6" />
              PostgreSQL Database
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure database schema, tables, columns, and views
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="views" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Views
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="tables" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Database Tables</h3>
                  <p className="text-sm text-muted-foreground">Define tables with columns and indexes</p>
                </div>
                <Button onClick={addTable} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button>
              </div>

              <div className="space-y-6">
                {tables.map((table, tableIndex) => (
                  <div key={table.id} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table className="h-5 w-5" />
                        <Input
                          value={table.name}
                          onChange={(e) => updateTable(tableIndex, { name: e.target.value })}
                          placeholder="Table Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        <Badge variant="outline">{table.schema}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTable(tableIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Schema</Label>
                        <Input
                          value={table.schema}
                          onChange={(e) => updateTable(tableIndex, { schema: e.target.value })}
                          placeholder="public"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Columns Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          <Label className="text-base font-semibold">Columns</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addColumn(tableIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Column
                        </Button>
                      </div>

                      {table.columns && table.columns.length > 0 ? (
                        <div className="space-y-3">
                          {table.columns.map((column, columnIndex) => (
                            <div key={column.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={column.name}
                                    onChange={(e) => updateColumn(tableIndex, columnIndex, { name: e.target.value })}
                                    placeholder="column_name"
                                    className="font-mono border-0 bg-transparent p-0 h-auto font-semibold flex-1"
                                  />
                                  {column.primaryKey && <Badge variant="default">PK</Badge>}
                                  {column.unique && !column.primaryKey && <Badge variant="outline">UNIQUE</Badge>}
                                  {!column.nullable && <Badge variant="secondary">NOT NULL</Badge>}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeColumn(tableIndex, columnIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-xs">Data Type</Label>
                                  <select
                                    value={column.type}
                                    onChange={(e) => updateColumn(tableIndex, columnIndex, { type: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
                                  >
                                    {columnTypes.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Default Value</Label>
                                  <Input
                                    value={column.defaultValue || ''}
                                    onChange={(e) =>
                                      updateColumn(tableIndex, columnIndex, { defaultValue: e.target.value })
                                    }
                                    placeholder="NULL"
                                    className="font-mono text-sm"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={column.primaryKey}
                                    onCheckedChange={(checked) => {
                                      updateColumn(tableIndex, columnIndex, {
                                        primaryKey: checked,
                                        unique: checked ? true : column.unique,
                                      });
                                    }}
                                  />
                                  <Label className="text-xs">Primary Key</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={column.unique}
                                    onCheckedChange={(checked) =>
                                      updateColumn(tableIndex, columnIndex, { unique: checked })
                                    }
                                    disabled={column.primaryKey}
                                  />
                                  <Label className="text-xs">Unique</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={column.nullable}
                                    onCheckedChange={(checked) =>
                                      updateColumn(tableIndex, columnIndex, { nullable: checked })
                                    }
                                  />
                                  <Label className="text-xs">Nullable</Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No columns defined. Click "Add Column" to create one.
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Indexes Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Indexes</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addIndex(tableIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Index
                        </Button>
                      </div>

                      {table.indexes && table.indexes.length > 0 ? (
                        <div className="space-y-3">
                          {table.indexes.map((index, indexIndex) => (
                            <div key={index.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={index.name}
                                    onChange={(e) => updateIndex(tableIndex, indexIndex, { name: e.target.value })}
                                    placeholder="index_name"
                                    className="font-mono border-0 bg-transparent p-0 h-auto font-semibold flex-1"
                                  />
                                  {index.unique && <Badge variant="outline">UNIQUE</Badge>}
                                  <Badge variant="secondary">{index.type}</Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeIndex(tableIndex, indexIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-xs">Index Type</Label>
                                  <select
                                    value={index.type}
                                    onChange={(e) =>
                                      updateIndex(tableIndex, indexIndex, {
                                        type: e.target.value as Index['type'],
                                      })
                                    }
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  >
                                    <option value="btree">B-Tree</option>
                                    <option value="hash">Hash</option>
                                    <option value="gin">GIN</option>
                                    <option value="gist">GiST</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Columns (comma-separated)</Label>
                                  <Input
                                    value={index.columns.join(', ')}
                                    onChange={(e) =>
                                      updateIndex(tableIndex, indexIndex, {
                                        columns: e.target.value.split(',').map((c) => c.trim()).filter(Boolean),
                                      })
                                    }
                                    placeholder="column1, column2"
                                    className="font-mono text-sm"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={index.unique}
                                  onCheckedChange={(checked) =>
                                    updateIndex(tableIndex, indexIndex, { unique: checked })
                                  }
                                />
                                <Label className="text-xs">Unique Index</Label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No indexes defined. Click "Add Index" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {tables.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Table className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tables defined. Click "Add Table" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="views" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Database Views</h3>
                  <p className="text-sm text-muted-foreground">Define views for data access</p>
                </div>
                <Button onClick={addView} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add View
                </Button>
              </div>

              <div className="space-y-4">
                {views.map((view, index) => (
                  <div key={view.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        <Input
                          value={view.name}
                          onChange={(e) => updateView(index, { name: e.target.value })}
                          placeholder="View Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeView(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={view.description || ''}
                        onChange={(e) => updateView(index, { description: e.target.value })}
                        placeholder="View description"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>SQL Query</Label>
                      <textarea
                        value={view.query}
                        onChange={(e) => updateView(index, { query: e.target.value })}
                        placeholder="SELECT * FROM table_name WHERE condition"
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={6}
                      />
                    </div>
                  </div>
                ))}

                {views.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No views defined. Click "Add View" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Connection Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <Input
                        value={config.host || ''}
                        onChange={(e) => updateConfig({ host: e.target.value })}
                        placeholder="localhost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        value={config.port || ''}
                        onChange={(e) => updateConfig({ port: parseInt(e.target.value) || undefined })}
                        placeholder="5432"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Database Name</Label>
                      <Input
                        value={config.database || ''}
                        onChange={(e) => updateConfig({ database: e.target.value })}
                        placeholder="postgres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={config.username || ''}
                        onChange={(e) => updateConfig({ username: e.target.value })}
                        placeholder="postgres"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={config.password || ''}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>SSL Mode</Label>
                    <select
                      value={config.sslMode || 'prefer'}
                      onChange={(e) => updateConfig({ sslMode: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="disable">Disable</option>
                      <option value="allow">Allow</option>
                      <option value="prefer">Prefer</option>
                      <option value="require">Require</option>
                      <option value="verify-ca">Verify CA</option>
                      <option value="verify-full">Verify Full</option>
                    </select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max Connections</Label>
                      <Input
                        type="number"
                        value={config.maxConnections || ''}
                        onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || undefined })}
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Connection Pool Size</Label>
                      <Input
                        type="number"
                        value={config.poolSize || ''}
                        onChange={(e) => updateConfig({ poolSize: parseInt(e.target.value) || undefined })}
                        placeholder="20"
                      />
                    </div>
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

