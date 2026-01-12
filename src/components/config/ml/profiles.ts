import { ComponentProfile } from '../shared/types';

export const ML_PROFILES: Record<string, ComponentProfile> = {
  spark: {
    id: 'spark',
    title: 'Apache Spark',
    description: 'Unified analytics engine for large-scale data processing.',
    badge: 'Big Data',
    docsUrl: 'https://spark.apache.org/',
    defaults: {
      master: 'local[*]',
      appName: 'archiphoenix-spark',
      driverMemory: '2g',
      executorMemory: '4g',
      executorCores: 2,
      enableDynamicAllocation: true,
      minExecutors: 1,
      maxExecutors: 10,
      enableCheckpointing: true,
      checkpointDirectory: '/checkpoint',
      enableStreaming: false,
      streamingBatchInterval: 1000,
    },
    sections: [
      {
        id: 'cluster',
        title: 'Cluster Configuration',
        fields: [
          {
            id: 'master',
            label: 'Master URL',
            type: 'text',
            placeholder: 'local[*]',
            description: 'Spark master URL (local[*], spark://host:port, yarn)',
          },
          {
            id: 'appName',
            label: 'Application Name',
            type: 'text',
            placeholder: 'my-spark-app',
          },
        ],
      },
      {
        id: 'resources',
        title: 'Resource Allocation',
        fields: [
          {
            id: 'driverMemory',
            label: 'Driver Memory',
            type: 'text',
            placeholder: '2g',
            description: 'Memory for driver process',
          },
          {
            id: 'executorMemory',
            label: 'Executor Memory',
            type: 'text',
            placeholder: '4g',
            description: 'Memory per executor',
          },
          {
            id: 'executorCores',
            label: 'Executor Cores',
            type: 'number',
            min: 1,
            max: 32,
            description: 'Number of cores per executor',
          },
        ],
      },
      {
        id: 'allocation',
        title: 'Dynamic Allocation',
        fields: [
          {
            id: 'enableDynamicAllocation',
            label: 'Enable Dynamic Allocation',
            type: 'toggle',
            description: 'Dynamically scale executors',
          },
          {
            id: 'minExecutors',
            label: 'Min Executors',
            type: 'number',
            min: 1,
            max: 100,
          },
          {
            id: 'maxExecutors',
            label: 'Max Executors',
            type: 'number',
            min: 1,
            max: 1000,
          },
        ],
      },
      {
        id: 'checkpointing',
        title: 'Checkpointing',
        fields: [
          {
            id: 'enableCheckpointing',
            label: 'Enable Checkpointing',
            type: 'toggle',
            description: 'Save state for fault tolerance',
          },
          {
            id: 'checkpointDirectory',
            label: 'Checkpoint Directory',
            type: 'text',
            placeholder: '/checkpoint',
          },
        ],
      },
      {
        id: 'streaming',
        title: 'Streaming',
        fields: [
          {
            id: 'enableStreaming',
            label: 'Enable Streaming',
            type: 'toggle',
          },
          {
            id: 'streamingBatchInterval',
            label: 'Batch Interval',
            type: 'number',
            min: 100,
            max: 60000,
            suffix: 'ms',
            description: 'Streaming batch interval',
          },
        ],
      },
    ],
  },
  'tensorflow-serving': {
    id: 'tensorflow-serving',
    title: 'TensorFlow Serving',
    description: 'Serving system for machine learning models designed for production.',
    badge: 'ML Serving',
    docsUrl: 'https://www.tensorflow.org/tfx/guide/serving',
    defaults: {
      modelBasePath: '/models',
      modelName: 'my-model',
      modelVersion: '1',
      enableBatching: true,
      batchSize: 32,
      maxBatchSize: 128,
      enableGPU: false,
      gpuMemoryFraction: 0.5,
      enableMonitoring: true,
      monitoringPort: 8501,
    },
    sections: [
      {
        id: 'model',
        title: 'Model Configuration',
        fields: [
          {
            id: 'modelBasePath',
            label: 'Model Base Path',
            type: 'text',
            placeholder: '/models',
          },
          {
            id: 'modelName',
            label: 'Model Name',
            type: 'text',
            placeholder: 'my-model',
          },
          {
            id: 'modelVersion',
            label: 'Model Version',
            type: 'text',
            placeholder: '1',
          },
        ],
      },
      {
        id: 'batching',
        title: 'Batching',
        fields: [
          {
            id: 'enableBatching',
            label: 'Enable Batching',
            type: 'toggle',
            description: 'Batch multiple requests',
          },
          {
            id: 'batchSize',
            label: 'Batch Size',
            type: 'number',
            min: 1,
            max: 1000,
            description: 'Default batch size',
          },
          {
            id: 'maxBatchSize',
            label: 'Max Batch Size',
            type: 'number',
            min: 1,
            max: 10000,
            description: 'Maximum batch size',
          },
        ],
      },
      {
        id: 'gpu',
        title: 'GPU Configuration',
        fields: [
          {
            id: 'enableGPU',
            label: 'Enable GPU',
            type: 'toggle',
          },
          {
            id: 'gpuMemoryFraction',
            label: 'GPU Memory Fraction',
            type: 'number',
            min: 0.1,
            max: 1.0,
            step: 0.1,
            description: 'Fraction of GPU memory to use',
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          {
            id: 'enableMonitoring',
            label: 'Enable Monitoring',
            type: 'toggle',
          },
          {
            id: 'monitoringPort',
            label: 'Monitoring Port',
            type: 'number',
            min: 1024,
            max: 65535,
            description: 'Port for monitoring API',
          },
        ],
      },
    ],
  },
  'pytorch-serve': {
    id: 'pytorch-serve',
    title: 'PyTorch Serve',
    description: 'Model serving framework for PyTorch models.',
    badge: 'ML Serving',
    docsUrl: 'https://pytorch.org/serve/',
    defaults: {
      modelStore: '/models',
      enableWorkers: true,
      numWorkers: 1,
      enableBatching: true,
      batchSize: 1,
      maxBatchDelay: 100,
      enableGPU: false,
      enableMetrics: true,
      metricsPort: 8082,
    },
    sections: [
      {
        id: 'model',
        title: 'Model Store',
        fields: [
          {
            id: 'modelStore',
            label: 'Model Store Path',
            type: 'text',
            placeholder: '/models',
          },
        ],
      },
      {
        id: 'workers',
        title: 'Workers',
        fields: [
          {
            id: 'enableWorkers',
            label: 'Enable Workers',
            type: 'toggle',
          },
          {
            id: 'numWorkers',
            label: 'Number of Workers',
            type: 'number',
            min: 1,
            max: 100,
            description: 'Concurrent worker processes',
          },
        ],
      },
      {
        id: 'batching',
        title: 'Batching',
        fields: [
          {
            id: 'enableBatching',
            label: 'Enable Batching',
            type: 'toggle',
          },
          {
            id: 'batchSize',
            label: 'Batch Size',
            type: 'number',
            min: 1,
            max: 1000,
          },
          {
            id: 'maxBatchDelay',
            label: 'Max Batch Delay',
            type: 'number',
            min: 1,
            max: 10000,
            suffix: 'ms',
            description: 'Maximum delay before batching',
          },
        ],
      },
      {
        id: 'gpu',
        title: 'GPU',
        fields: [
          {
            id: 'enableGPU',
            label: 'Enable GPU',
            type: 'toggle',
          },
        ],
      },
      {
        id: 'metrics',
        title: 'Metrics',
        fields: [
          {
            id: 'enableMetrics',
            label: 'Enable Metrics',
            type: 'toggle',
          },
          {
            id: 'metricsPort',
            label: 'Metrics Port',
            type: 'number',
            min: 1024,
            max: 65535,
          },
        ],
      },
    ],
  },
  'feature-store': {
    id: 'feature-store',
    title: 'Feature Store',
    description: 'Centralized repository for storing and serving ML features.',
    badge: 'ML Infrastructure',
    defaults: {
      featureStoreType: 'feast',
      enableOnlineServing: true,
      onlineStoreType: 'redis',
      onlineStoreUrl: 'redis://localhost:6379',
      enableOfflineServing: true,
      offlineStoreType: 'snowflake',
      enableFeatureValidation: true,
      enableFeatureMonitoring: true,
      ttlDays: 30,
    },
    sections: [
      {
        id: 'store',
        title: 'Feature Store Configuration',
        fields: [
          {
            id: 'featureStoreType',
            label: 'Feature Store Type',
            type: 'select',
            options: [
              { label: 'Feast', value: 'feast' },
              { label: 'Tecton', value: 'tecton' },
              { label: 'Hopsworks', value: 'hopsworks' },
            ],
          },
        ],
      },
      {
        id: 'online',
        title: 'Online Serving',
        fields: [
          {
            id: 'enableOnlineServing',
            label: 'Enable Online Serving',
            type: 'toggle',
            description: 'Low-latency feature serving',
          },
          {
            id: 'onlineStoreType',
            label: 'Online Store Type',
            type: 'select',
            options: [
              { label: 'Redis', value: 'redis' },
              { label: 'DynamoDB', value: 'dynamodb' },
              { label: 'Cassandra', value: 'cassandra' },
            ],
          },
          {
            id: 'onlineStoreUrl',
            label: 'Online Store URL',
            type: 'text',
            placeholder: 'redis://localhost:6379',
          },
        ],
      },
      {
        id: 'offline',
        title: 'Offline Serving',
        fields: [
          {
            id: 'enableOfflineServing',
            label: 'Enable Offline Serving',
            type: 'toggle',
            description: 'Batch feature serving',
          },
          {
            id: 'offlineStoreType',
            label: 'Offline Store Type',
            type: 'select',
            options: [
              { label: 'Snowflake', value: 'snowflake' },
              { label: 'BigQuery', value: 'bigquery' },
              { label: 'Redshift', value: 'redshift' },
            ],
          },
        ],
      },
      {
        id: 'validation',
        title: 'Validation & Monitoring',
        fields: [
          {
            id: 'enableFeatureValidation',
            label: 'Enable Feature Validation',
            type: 'toggle',
            description: 'Validate feature values',
          },
          {
            id: 'enableFeatureMonitoring',
            label: 'Enable Feature Monitoring',
            type: 'toggle',
            description: 'Monitor feature quality',
          },
          {
            id: 'ttlDays',
            label: 'TTL Days',
            type: 'number',
            min: 1,
            max: 365,
            suffix: 'days',
            description: 'Feature time-to-live',
          },
        ],
      },
    ],
  },
};

