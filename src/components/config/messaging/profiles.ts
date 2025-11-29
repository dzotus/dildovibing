import { MessagingProfile } from './types';

export const MESSAGING_PROFILES: Record<string, MessagingProfile> = {
  activemq: {
    id: 'activemq',
    title: 'ActiveMQ Broker',
    description: 'Configure broker endpoints, credentials, queues and durability guarantees for ActiveMQ clusters.',
    docsUrl: 'https://activemq.apache.org/',
    defaults: {
      brokerUrl: 'amqp://localhost:5672',
      protocol: 'amqp',
      username: 'admin',
      password: 'admin',
      queues: ['orders', 'payments'],
      durableSubscriptions: true,
      maxConnections: 1000,
      retryInterval: 5,
    },
    sections: [
      {
        id: 'connection',
        title: 'Connectivity',
        description: 'Endpoints and authentication to reach the broker.',
        fields: [
          { id: 'brokerUrl', label: 'Broker URL', type: 'text', placeholder: 'amqp://broker:5672' },
          {
            id: 'protocol',
            label: 'Protocol',
            type: 'select',
            options: [
              { label: 'AMQP', value: 'amqp' },
              { label: 'OpenWire', value: 'openwire' },
              { label: 'MQTT', value: 'mqtt' },
              { label: 'STOMP', value: 'stomp' },
            ],
          },
          { id: 'username', label: 'Username', type: 'text' },
          { id: 'password', label: 'Password', type: 'text' },
        ],
      },
      {
        id: 'destinations',
        title: 'Destinations',
        description: 'Queues and topics served by this broker.',
        fields: [
          {
            id: 'queues',
            label: 'Queues / Topics',
            type: 'list',
            description: 'List of logical destinations exposed by the broker.',
            defaultListItem: 'new-queue',
          },
        ],
      },
      {
        id: 'reliability',
        title: 'Reliability & Throughput',
        fields: [
          {
            id: 'durableSubscriptions',
            label: 'Durable Subscriptions',
            type: 'toggle',
            description: 'Persist subscriptions across broker restarts.',
          },
          {
            id: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            min: 1,
            max: 10000,
            step: 10,
          },
          {
            id: 'retryInterval',
            label: 'Retry Interval',
            type: 'number',
            min: 1,
            step: 1,
            suffix: 'sec',
          },
        ],
      },
    ],
  },
  'aws-sqs': {
    id: 'aws-sqs',
    title: 'Amazon SQS Queue',
    description: 'Model queue characteristics, delivery guarantees and access credentials for SQS.',
    docsUrl: 'https://aws.amazon.com/sqs/',
    defaults: {
      queueName: 'orders-queue',
      region: 'us-east-1',
      accessKey: '',
      secretKey: '',
      delaySeconds: 0,
      visibilityTimeout: 30,
      messageRetention: 4,
      fifo: false,
      contentBasedDedup: false,
      deadLetterQueue: '',
    },
    sections: [
      {
        id: 'identity',
        title: 'Queue Basics',
        fields: [
          { id: 'queueName', label: 'Queue Name', type: 'text', placeholder: 'orders-queue' },
          { id: 'region', label: 'AWS Region', type: 'text', placeholder: 'us-east-1' },
          { id: 'deadLetterQueue', label: 'Dead-Letter Queue', type: 'text', placeholder: 'dlq-name' },
        ],
      },
      {
        id: 'delivery',
        title: 'Delivery Behavior',
        fields: [
          { id: 'delaySeconds', label: 'Delivery Delay', type: 'number', min: 0, max: 900, suffix: 'sec' },
          {
            id: 'visibilityTimeout',
            label: 'Visibility Timeout',
            type: 'number',
            min: 0,
            max: 43200,
            suffix: 'sec',
          },
          {
            id: 'messageRetention',
            label: 'Retention Period',
            type: 'number',
            min: 1,
            max: 14,
            suffix: 'days',
          },
        ],
      },
      {
        id: 'guarantees',
        title: 'Guarantees & Security',
        fields: [
          {
            id: 'fifo',
            label: 'FIFO Queue',
            type: 'toggle',
            description: 'Guarantee order and exactly-once processing.',
          },
          {
            id: 'contentBasedDedup',
            label: 'Content-Based Deduplication',
            type: 'toggle',
            description: 'Avoid duplicates by hashing message body.',
          },
          { id: 'accessKey', label: 'Access Key', type: 'text' },
          { id: 'secretKey', label: 'Secret Key', type: 'text' },
        ],
      },
    ],
  },
  'azure-service-bus': {
    id: 'azure-service-bus',
    title: 'Azure Service Bus',
    description: 'Queues/topics with sessions, dead-lettering and max delivery control.',
    docsUrl: 'https://azure.microsoft.com/services/service-bus/',
    defaults: {
      namespace: 'archiphoenix.servicebus.windows.net',
      entityType: 'queue',
      entityName: 'events',
      subscriptionName: 'default',
      connectionString: '',
      maxDeliveryCount: 10,
      lockDuration: 30,
      enableSessions: false,
    },
    sections: [
      {
        id: 'namespace',
        title: 'Namespace & Entities',
        fields: [
          { id: 'namespace', label: 'Namespace', type: 'text', placeholder: 'mybus.servicebus.windows.net' },
          {
            id: 'entityType',
            label: 'Entity Type',
            type: 'select',
            options: [
              { label: 'Queue', value: 'queue' },
              { label: 'Topic', value: 'topic' },
            ],
          },
          { id: 'entityName', label: 'Queue / Topic Name', type: 'text' },
          { id: 'subscriptionName', label: 'Subscription', type: 'text', placeholder: 'optional' },
        ],
      },
      {
        id: 'access',
        title: 'Access',
        fields: [
          {
            id: 'connectionString',
            label: 'Connection String (SAS)',
            type: 'textarea',
            placeholder: 'Endpoint=sb://...;',
          },
        ],
      },
      {
        id: 'delivery',
        title: 'Delivery & Sessions',
        fields: [
          {
            id: 'maxDeliveryCount',
            label: 'Max Delivery Count',
            type: 'number',
            min: 1,
            max: 100,
          },
          {
            id: 'lockDuration',
            label: 'Lock Duration',
            type: 'number',
            min: 5,
            max: 300,
            suffix: 'sec',
          },
          {
            id: 'enableSessions',
            label: 'Enable Sessions',
            type: 'toggle',
            description: 'Order-sensitive processing for conversations.',
          },
        ],
      },
    ],
  },
  'gcp-pubsub': {
    id: 'gcp-pubsub',
    title: 'Google Pub/Sub',
    description: 'Topics/subscriptions with ack deadlines and push endpoints.',
    docsUrl: 'https://cloud.google.com/pubsub',
    defaults: {
      projectId: 'archiphoenix-lab',
      topic: 'events',
      subscription: 'events-sub',
      ackDeadline: 10,
      maxOutstandingMessages: 1000,
      pushEndpoint: '',
      enableOrdering: false,
    },
    sections: [
      {
        id: 'identifiers',
        title: 'Identifiers',
        fields: [
          { id: 'projectId', label: 'Project ID', type: 'text' },
          { id: 'topic', label: 'Topic', type: 'text' },
          { id: 'subscription', label: 'Subscription', type: 'text' },
        ],
      },
      {
        id: 'delivery',
        title: 'Delivery Parameters',
        fields: [
          {
            id: 'ackDeadline',
            label: 'Ack Deadline',
            type: 'number',
            min: 10,
            max: 600,
            suffix: 'sec',
          },
          {
            id: 'maxOutstandingMessages',
            label: 'Max Outstanding Messages',
            type: 'number',
            min: 100,
            max: 10000,
          },
          {
            id: 'enableOrdering',
            label: 'Message Ordering',
            type: 'toggle',
            description: 'Guarantee ordering per ordering key.',
          },
        ],
      },
      {
        id: 'push',
        title: 'Push Configuration',
        fields: [
          {
            id: 'pushEndpoint',
            label: 'Push Endpoint URL',
            type: 'text',
            placeholder: 'https://api.service/push',
          },
        ],
      },
    ],
  },
};

