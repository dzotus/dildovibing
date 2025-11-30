import { ComponentProfile } from '@/components/config/shared/types';

export const ML_PROFILES: Record<string, ComponentProfile> = {
  spark: {
    id: 'spark',
    title: 'Apache Spark',
    description: 'Configure Spark cluster, executors, memory, and job scheduling',
    defaults: {
      masterUrl: 'spark://localhost:7077',
      executorMemory: '2g',
      executorCores: 2,
      driverMemory: '1g',
      driverCores: 1,
      maxExecutors: 10,
      minExecutors: 1,
      enableDynamicAllocation: true,
      sparkVersion: '3.5.0',
      enableHive: false,
    },
    sections: [
      {
        id: 'cluster',
        title: 'Cluster Configuration',
        fields: [
          { id: 'masterUrl', label: 'Master URL', type: 'text', placeholder: 'spark://localhost:7077' },
          { id: 'sparkVersion', label: 'Spark Version', type: 'text', placeholder: '3.5.0' },
        ],
      },
      {
        id: 'executor',
        title: 'Executor Settings',
        fields: [
          { id: 'executorMemory', label: 'Executor Memory', type: 'text', placeholder: '2g' },
          { id: 'executorCores', label: 'Executor Cores', type: 'number', placeholder: '2' },
          { id: 'maxExecutors', label: 'Max Executors', type: 'number', placeholder: '10' },
          { id: 'minExecutors', label: 'Min Executors', type: 'number', placeholder: '1' },
          { id: 'enableDynamicAllocation', label: 'Enable Dynamic Allocation', type: 'toggle' },
        ],
      },
      {
        id: 'driver',
        title: 'Driver Settings',
        fields: [
          { id: 'driverMemory', label: 'Driver Memory', type: 'text', placeholder: '1g' },
          { id: 'driverCores', label: 'Driver Cores', type: 'number', placeholder: '1' },
        ],
      },
      {
        id: 'features',
        title: 'Features',
        fields: [
          { id: 'enableHive', label: 'Enable Hive Support', type: 'toggle' },
        ],
      },
    ],
  },
  'tensorflow-serving': {
    id: 'tensorflow-serving',
    title: 'TensorFlow Serving',
    description: 'Configure TensorFlow model serving, batching, and versioning',
    defaults: {
      port: 8501,
      restApiPort: 8501,
      grpcPort: 8500,
      modelBasePath: '/models',
      modelName: 'my_model',
      modelVersion: '1',
      enableBatching: true,
      maxBatchSize: 32,
      batchTimeout: 100,
      enableGPU: false,
      numGpus: 0,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'restApiPort', label: 'REST API Port', type: 'number', placeholder: '8501' },
          { id: 'grpcPort', label: 'gRPC Port', type: 'number', placeholder: '8500' },
        ],
      },
      {
        id: 'model',
        title: 'Model Configuration',
        fields: [
          { id: 'modelBasePath', label: 'Model Base Path', type: 'text', placeholder: '/models' },
          { id: 'modelName', label: 'Model Name', type: 'text', placeholder: 'my_model' },
          { id: 'modelVersion', label: 'Model Version', type: 'text', placeholder: '1' },
        ],
      },
      {
        id: 'batching',
        title: 'Batching',
        fields: [
          { id: 'enableBatching', label: 'Enable Batching', type: 'toggle' },
          { id: 'maxBatchSize', label: 'Max Batch Size', type: 'number', placeholder: '32' },
          { id: 'batchTimeout', label: 'Batch Timeout (ms)', type: 'number', placeholder: '100' },
        ],
      },
      {
        id: 'gpu',
        title: 'GPU Support',
        fields: [
          { id: 'enableGPU', label: 'Enable GPU', type: 'toggle' },
          { id: 'numGpus', label: 'Number of GPUs', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },
  'pytorch-serve': {
    id: 'pytorch-serve',
    title: 'PyTorch Serve',
    description: 'Configure PyTorch model serving, handlers, and management',
    defaults: {
      port: 8080,
      managementPort: 8081,
      metricsPort: 8082,
      modelStore: '/models',
      modelName: 'my_model',
      handler: 'image_classifier',
      enableMetrics: true,
      workers: 1,
      maxWorkers: 4,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connection',
        fields: [
          { id: 'port', label: 'Inference Port', type: 'number', placeholder: '8080' },
          { id: 'managementPort', label: 'Management Port', type: 'number', placeholder: '8081' },
          { id: 'metricsPort', label: 'Metrics Port', type: 'number', placeholder: '8082' },
        ],
      },
      {
        id: 'model',
        title: 'Model Configuration',
        fields: [
          { id: 'modelStore', label: 'Model Store Path', type: 'text', placeholder: '/models' },
          { id: 'modelName', label: 'Model Name', type: 'text', placeholder: 'my_model' },
          { id: 'handler', label: 'Handler', type: 'text', placeholder: 'image_classifier' },
        ],
      },
      {
        id: 'workers',
        title: 'Workers',
        fields: [
          { id: 'workers', label: 'Number of Workers', type: 'number', placeholder: '1' },
          { id: 'maxWorkers', label: 'Max Workers', type: 'number', placeholder: '4' },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          { id: 'enableMetrics', label: 'Enable Metrics', type: 'toggle' },
        ],
      },
    ],
  },
  mlflow: {
    id: 'mlflow',
    title: 'MLflow Tracking',
    description: 'Configure MLflow tracking server, experiments, and model registry',
    defaults: {
      trackingUri: 'http://localhost:5000',
      backendStore: 'file',
      artifactStore: './mlruns',
      enableModelRegistry: true,
      enableUI: true,
      uiPort: 5000,
      enableAuthentication: false,
      defaultExperiment: 'Default',
    },
    sections: [
      {
        id: 'server',
        title: 'Server Configuration',
        fields: [
          { id: 'trackingUri', label: 'Tracking URI', type: 'text', placeholder: 'http://localhost:5000' },
          { id: 'uiPort', label: 'UI Port', type: 'number', placeholder: '5000' },
          { id: 'enableUI', label: 'Enable UI', type: 'toggle' },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        fields: [
          {
            id: 'backendStore',
            label: 'Backend Store',
            type: 'select',
            options: [
              { value: 'file', label: 'File System' },
              { value: 'sqlite', label: 'SQLite' },
              { value: 'postgresql', label: 'PostgreSQL' },
              { value: 'mysql', label: 'MySQL' },
            ],
          },
          { id: 'artifactStore', label: 'Artifact Store Path', type: 'text', placeholder: './mlruns' },
        ],
      },
      {
        id: 'experiments',
        title: 'Experiments',
        fields: [
          { id: 'defaultExperiment', label: 'Default Experiment', type: 'text', placeholder: 'Default' },
        ],
      },
      {
        id: 'registry',
        title: 'Model Registry',
        fields: [
          { id: 'enableModelRegistry', label: 'Enable Model Registry', type: 'toggle' },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        fields: [
          { id: 'enableAuthentication', label: 'Enable Authentication', type: 'toggle' },
        ],
      },
    ],
  },
  'feature-store': {
    id: 'feature-store',
    title: 'Feature Store',
    description: 'Configure feature store, online/offline storage, and feature serving',
    defaults: {
      featureStoreType: 'feast',
      onlineStore: 'redis',
      offlineStore: 'parquet',
      enableFeatureValidation: true,
      enableFeatureMonitoring: true,
      featureTTL: 86400,
      enablePointInTimeLookup: true,
    },
    sections: [
      {
        id: 'store',
        title: 'Feature Store',
        fields: [
          {
            id: 'featureStoreType',
            label: 'Feature Store Type',
            type: 'select',
            options: [
              { value: 'feast', label: 'Feast' },
              { value: 'tecton', label: 'Tecton' },
              { value: 'hopsworks', label: 'Hopsworks' },
            ],
          },
        ],
      },
      {
        id: 'storage',
        title: 'Storage',
        fields: [
          {
            id: 'onlineStore',
            label: 'Online Store',
            type: 'select',
            options: [
              { value: 'redis', label: 'Redis' },
              { value: 'dynamodb', label: 'DynamoDB' },
              { value: 'cassandra', label: 'Cassandra' },
            ],
          },
          {
            id: 'offlineStore',
            label: 'Offline Store',
            type: 'select',
            options: [
              { value: 'parquet', label: 'Parquet' },
              { value: 'bigquery', label: 'BigQuery' },
              { value: 'snowflake', label: 'Snowflake' },
            ],
          },
        ],
      },
      {
        id: 'features',
        title: 'Feature Settings',
        fields: [
          { id: 'featureTTL', label: 'Feature TTL (seconds)', type: 'number', placeholder: '86400' },
          { id: 'enablePointInTimeLookup', label: 'Enable Point-in-Time Lookup', type: 'toggle' },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        fields: [
          { id: 'enableFeatureValidation', label: 'Enable Feature Validation', type: 'toggle' },
          { id: 'enableFeatureMonitoring', label: 'Enable Feature Monitoring', type: 'toggle' },
        ],
      },
    ],
  },
};

