import { ComponentProfile } from '../shared/types';

export const DATA_PROFILES: Record<string, ComponentProfile> = {
  cassandra: {
    id: 'cassandra',
    title: 'Apache Cassandra',
    description: 'Distributed NoSQL database with high availability and linear scalability.',
    badge: 'NoSQL',
    docsUrl: 'https://cassandra.apache.org/',
    defaults: {
      clusterName: 'archiphoenix-cluster',
      contactPoints: ['localhost:9042'],
      keyspace: 'archiphoenix',
      replicationFactor: 3,
      consistencyLevel: 'QUORUM',
      datacenter: 'dc1',
      enableSSL: false,
      compression: 'LZ4',
    },
    sections: [
      {
        id: 'cluster',
        title: 'Cluster Configuration',
        description: 'Cassandra cluster connection and topology settings.',
        fields: [
          {
            id: 'clusterName',
            label: 'Cluster Name',
            type: 'text',
            placeholder: 'my-cluster',
          },
          {
            id: 'contactPoints',
            label: 'Contact Points',
            type: 'list',
            description: 'Comma-separated list of host:port addresses',
            defaultListItem: 'localhost:9042',
          },
          {
            id: 'datacenter',
            label: 'Datacenter',
            type: 'text',
            placeholder: 'dc1',
          },
        ],
      },
      {
        id: 'keyspace',
        title: 'Keyspace & Replication',
        fields: [
          {
            id: 'keyspace',
            label: 'Keyspace Name',
            type: 'text',
            placeholder: 'my_keyspace',
          },
          {
            id: 'replicationFactor',
            label: 'Replication Factor',
            type: 'number',
            min: 1,
            max: 10,
            description: 'Number of replicas for each data row',
          },
          {
            id: 'consistencyLevel',
            label: 'Consistency Level',
            type: 'select',
            options: [
              { label: 'ONE', value: 'ONE' },
              { label: 'QUORUM', value: 'QUORUM' },
              { label: 'ALL', value: 'ALL' },
              { label: 'LOCAL_QUORUM', value: 'LOCAL_QUORUM' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        title: 'Performance & Security',
        fields: [
          {
            id: 'compression',
            label: 'Compression',
            type: 'select',
            options: [
              { label: 'LZ4', value: 'LZ4' },
              { label: 'Snappy', value: 'Snappy' },
              { label: 'Deflate', value: 'Deflate' },
              { label: 'None', value: 'None' },
            ],
          },
          {
            id: 'enableSSL',
            label: 'Enable SSL',
            type: 'toggle',
            description: 'Encrypt connections to cluster',
          },
        ],
      },
    ],
  },
  clickhouse: {
    id: 'clickhouse',
    title: 'ClickHouse',
    description: 'Column-oriented database for real-time analytical data processing.',
    badge: 'Analytics',
    docsUrl: 'https://clickhouse.com/',
    defaults: {
      host: 'localhost',
      port: 8123,
      database: 'default',
      username: 'default',
      password: '',
      cluster: 'archiphoenix-cluster',
      engine: 'MergeTree',
      replication: false,
      compression: 'LZ4',
      maxMemoryUsage: 10000000000,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
          { id: 'port', label: 'Port', type: 'number', min: 1, max: 65535 },
          { id: 'database', label: 'Database', type: 'text' },
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'text' },
        ],
      },
      {
        id: 'cluster',
        title: 'Cluster Configuration',
        fields: [
          {
            id: 'cluster',
            label: 'Cluster Name',
            type: 'text',
            placeholder: 'my-cluster',
          },
          {
            id: 'replication',
            label: 'Replication',
            type: 'toggle',
            description: 'Enable data replication across shards',
          },
        ],
      },
      {
        id: 'engine',
        title: 'Table Engine',
        fields: [
          {
            id: 'engine',
            label: 'Engine Type',
            type: 'select',
            options: [
              { label: 'MergeTree', value: 'MergeTree' },
              { label: 'ReplicatedMergeTree', value: 'ReplicatedMergeTree' },
              { label: 'Distributed', value: 'Distributed' },
              { label: 'Memory', value: 'Memory' },
            ],
          },
          {
            id: 'compression',
            label: 'Compression',
            type: 'select',
            options: [
              { label: 'LZ4', value: 'LZ4' },
              { label: 'ZSTD', value: 'ZSTD' },
              { label: 'LZ4HC', value: 'LZ4HC' },
              { label: 'None', value: 'None' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        title: 'Performance',
        fields: [
          {
            id: 'maxMemoryUsage',
            label: 'Max Memory Usage',
            type: 'number',
            min: 1000000,
            suffix: 'bytes',
            description: 'Maximum memory for query processing',
          },
        ],
      },
    ],
  },
  snowflake: {
    id: 'snowflake',
    title: 'Snowflake',
    description: 'Cloud data platform with separation of storage and compute.',
    badge: 'Cloud Data',
    docsUrl: 'https://www.snowflake.com/',
    defaults: {
      // Значения по умолчанию генерируются динамически в SnowflakeConfigAdvanced
      // через getSnowflakeDefaults(nodeId) при первом открытии конфига
      account: '',
      region: '',
      warehouse: '',
      database: '',
      schema: 'PUBLIC',
      username: '',
      role: 'ACCOUNTADMIN',
      enableAutoSuspend: true,
      autoSuspendSeconds: 60,
      enableAutoResume: true,
    },
    sections: [
      {
        id: 'account',
        title: 'Account & Region',
        fields: [
          {
            id: 'account',
            label: 'Account Identifier',
            type: 'text',
            placeholder: 'myaccount',
          },
          {
            id: 'region',
            label: 'Region',
            type: 'text',
            placeholder: 'us-east-1',
          },
        ],
      },
      {
        id: 'warehouse',
        title: 'Warehouse Configuration',
        fields: [
          {
            id: 'warehouse',
            label: 'Warehouse Name',
            type: 'text',
            placeholder: 'COMPUTE_WH',
          },
          {
            id: 'enableAutoSuspend',
            label: 'Auto Suspend',
            type: 'toggle',
            description: 'Automatically suspend warehouse when idle',
          },
          {
            id: 'autoSuspendSeconds',
            label: 'Auto Suspend Delay',
            type: 'number',
            min: 60,
            max: 3600,
            suffix: 'sec',
            description: 'Idle time before suspension',
          },
          {
            id: 'enableAutoResume',
            label: 'Auto Resume',
            type: 'toggle',
            description: 'Automatically resume on query',
          },
        ],
      },
      {
        id: 'database',
        title: 'Database & Schema',
        fields: [
          { id: 'database', label: 'Database', type: 'text' },
          { id: 'schema', label: 'Schema', type: 'text' },
          { id: 'username', label: 'Username', type: 'text' },
          {
            id: 'role',
            label: 'Role',
            type: 'select',
            options: [
              { label: 'ACCOUNTADMIN', value: 'ACCOUNTADMIN' },
              { label: 'SYSADMIN', value: 'SYSADMIN' },
              { label: 'USERADMIN', value: 'USERADMIN' },
              { label: 'SECURITYADMIN', value: 'SECURITYADMIN' },
            ],
          },
        ],
      },
    ],
  },
  elasticsearch: {
    id: 'elasticsearch',
    title: 'Elasticsearch',
    description: 'Distributed search and analytics engine built on Apache Lucene.',
    badge: 'Search',
    docsUrl: 'https://www.elastic.co/elasticsearch/',
    defaults: {
      clusterName: 'archiphoenix-cluster',
      nodes: ['localhost:9200'],
      index: 'archiphoenix-index',
      shards: 5,
      replicas: 1,
      refreshInterval: '1s',
      enableSSL: false,
      enableAuth: false,
      username: 'elastic',
      password: '',
    },
    sections: [
      {
        id: 'cluster',
        title: 'Cluster Configuration',
        fields: [
          {
            id: 'clusterName',
            label: 'Cluster Name',
            type: 'text',
            placeholder: 'my-cluster',
          },
          {
            id: 'nodes',
            label: 'Node Addresses',
            type: 'list',
            description: 'Elasticsearch node endpoints',
            defaultListItem: 'localhost:9200',
          },
        ],
      },
      {
        id: 'index',
        title: 'Index Settings',
        fields: [
          {
            id: 'index',
            label: 'Index Name',
            type: 'text',
            placeholder: 'my-index',
          },
          {
            id: 'shards',
            label: 'Number of Shards',
            type: 'number',
            min: 1,
            max: 100,
            description: 'Primary shards for horizontal scaling',
          },
          {
            id: 'replicas',
            label: 'Number of Replicas',
            type: 'number',
            min: 0,
            max: 10,
            description: 'Replica shards for high availability',
          },
          {
            id: 'refreshInterval',
            label: 'Refresh Interval',
            type: 'text',
            placeholder: '1s',
            description: 'How often to refresh the index (e.g., 1s, 5m)',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          {
            id: 'enableSSL',
            label: 'Enable SSL/TLS',
            type: 'toggle',
          },
          {
            id: 'enableAuth',
            label: 'Enable Authentication',
            type: 'toggle',
          },
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'text' },
        ],
      },
    ],
  },
  's3-datalake': {
    id: 's3-datalake',
    title: 'S3 Data Lake',
    description: 'Object storage for building data lakes with versioning and lifecycle policies.',
    badge: 'Storage',
    docsUrl: 'https://aws.amazon.com/s3/',
    defaults: {
      bucketName: 'archiphoenix-datalake',
      region: 'us-east-1',
      accessKey: '',
      secretKey: '',
      enableVersioning: true,
      enableEncryption: true,
      encryptionType: 'AES256',
      lifecycleDays: 90,
      enableGlacier: false,
      glacierDays: 365,
    },
    sections: [
      {
        id: 'bucket',
        title: 'Bucket Configuration',
        fields: [
          {
            id: 'bucketName',
            label: 'Bucket Name',
            type: 'text',
            placeholder: 'my-datalake',
          },
          {
            id: 'region',
            label: 'AWS Region',
            type: 'text',
            placeholder: 'us-east-1',
          },
        ],
      },
      {
        id: 'credentials',
        title: 'Credentials',
        fields: [
          { id: 'accessKey', label: 'Access Key ID', type: 'text' },
          { id: 'secretKey', label: 'Secret Access Key', type: 'text' },
        ],
      },
      {
        id: 'versioning',
        title: 'Versioning & Lifecycle',
        fields: [
          {
            id: 'enableVersioning',
            label: 'Enable Versioning',
            type: 'toggle',
            description: 'Keep multiple versions of objects',
          },
          {
            id: 'lifecycleDays',
            label: 'Lifecycle Days',
            type: 'number',
            min: 1,
            max: 3650,
            suffix: 'days',
            description: 'Days before transitioning to cheaper storage',
          },
        ],
      },
      {
        id: 'encryption',
        title: 'Encryption & Archive',
        fields: [
          {
            id: 'enableEncryption',
            label: 'Enable Encryption',
            type: 'toggle',
          },
          {
            id: 'encryptionType',
            label: 'Encryption Type',
            type: 'select',
            options: [
              { label: 'AES256', value: 'AES256' },
              { label: 'aws:kms', value: 'aws:kms' },
            ],
          },
          {
            id: 'enableGlacier',
            label: 'Enable Glacier Archive',
            type: 'toggle',
            description: 'Archive old data to Glacier',
          },
          {
            id: 'glacierDays',
            label: 'Glacier Transition Days',
            type: 'number',
            min: 90,
            max: 3650,
            suffix: 'days',
          },
        ],
      },
    ],
  },
};

