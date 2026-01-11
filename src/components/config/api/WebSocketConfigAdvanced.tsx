import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { CanvasNode } from '@/types';
import { useEffect } from 'react';
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
  Send,
  Code,
  CheckCircle,
  XCircle,
  Zap,
  Network,
  Users,
  MessageSquare,
  Home,
  Bell,
  Shield,
  Edit2
} from 'lucide-react';
import { showValidationError, showError, showSuccess } from '@/utils/toast';

interface WebSocketConfigProps {
  componentId: string;
}

interface Connection {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedAt?: string;
  messagesSent?: number;
  messagesReceived?: number;
  lastMessage?: string;
}

interface Message {
  id: string;
  type: 'sent' | 'received';
  content: string;
  timestamp: string;
}

interface Room {
  id: string;
  name: string;
  connections?: string[];
  messagesBroadcast?: number;
  createdAt?: number;
  description?: string;
}

interface Subscription {
  id: string;
  topic: string;
  connections?: string[];
  messagesDelivered?: number;
  createdAt?: number;
  enabled?: boolean;
}

interface WebSocketConfig {
  connections?: Connection[];
  messages?: Message[];
  rooms?: Room[];
  subscriptions?: Subscription[];
  endpoint?: string;
  protocol?: string;
  totalConnections?: number;
  activeConnections?: number;
  totalMessages?: number;
  enableCompression?: boolean;
  enablePingPong?: boolean;
  pingInterval?: number;
  maxConnections?: number;
  maxMessageSize?: number;
  roomsEnabled?: boolean;
  subscriptionsEnabled?: boolean;
  authentication?: {
    enabled?: boolean;
    method?: 'none' | 'token' | 'apiKey' | 'basic';
    token?: string;
    apiKey?: string;
  };
  rateLimit?: {
    enabled?: boolean;
    messagesPerSecond?: number;
    connectionsPerSecond?: number;
  };
}

export function WebSocketConfigAdvanced({ componentId }: WebSocketConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebSocketConfig;
  const componentMetrics = getComponentMetrics(componentId);
  const wsEngine = emulationEngine.getWebSocketEmulationEngine(componentId);
  
  // Get metrics from emulation engine if available
  const wsMetrics = wsEngine?.getWebSocketMetrics();
  
  // Use metrics from emulation if available, otherwise use config
  const connections = config.connections || [];
  const messages = config.messages || [];
  const rooms = config.rooms || [];
  const subscriptions = config.subscriptions || [];
  const endpoint = config.endpoint || 'ws://localhost:8080/ws';
  const protocol = config.protocol || 'ws';
  
  // Подсчет активных соединений: только те, что имеют статус 'connected'
  const activeConnectionsCount = connections.filter((c) => c.status === 'connected').length;
  const totalConnections = wsMetrics?.connectionsTotal || config.totalConnections || connections.length;
  const activeConnections = wsMetrics?.connectionsActive || config.activeConnections || activeConnectionsCount;
  const totalMessages = wsMetrics?.messagesTotal || config.totalMessages || messages.length;
  
  // State declarations - должны быть перед useEffect
  const [messageText, setMessageText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [testClientConnectionId, setTestClientConnectionId] = useState<string | null>(null);
  const [connectedEndpoint, setConnectedEndpoint] = useState<string | null>(null); // Endpoint, к которому подключены
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [subscriptionTopic, setSubscriptionTopic] = useState('');
  
  // Проверяем, есть ли активное соединение из тест-клиента
  useEffect(() => {
    if (testClientConnectionId) {
      const testConn = connections.find(c => c.id === testClientConnectionId);
      if (testConn && testConn.status === 'connected') {
        setIsConnected(true);
        // Восстанавливаем endpoint, если он не установлен
        if (!connectedEndpoint) {
          setConnectedEndpoint(endpoint);
        }
      } else {
        setIsConnected(false);
        setTestClientConnectionId(null);
        setConnectedEndpoint(null);
      }
    } else {
      // Проверяем, есть ли соединение из тест-клиента в списке
      const testConn = connections.find(c => c.id.startsWith('test-client-'));
      if (testConn && testConn.status === 'connected') {
        setTestClientConnectionId(testConn.id);
        setIsConnected(true);
        // Восстанавливаем endpoint из текущего конфига
        if (!connectedEndpoint) {
          setConnectedEndpoint(endpoint);
        }
      } else if (isConnected) {
        // Если соединение было, но больше нет в списке - отключаем
        setIsConnected(false);
        setConnectedEndpoint(null);
      }
    }
  }, [connections, testClientConnectionId, endpoint, connectedEndpoint, isConnected]);
  
  // Sync metrics from emulation to config periodically
  useEffect(() => {
    if (!isRunning || !wsEngine) return;
    
    const interval = setInterval(() => {
      // Получаем актуальные данные из узла, чтобы избежать устаревших значений
      const currentNode = nodes.find((n) => n.id === componentId);
      if (!currentNode) return;
      
      const currentConfig = (currentNode.data.config as any) || {} as WebSocketConfig;
      
      const metrics = wsEngine.getWebSocketMetrics();
      const activeConnectionsFromEngine = wsEngine.getActiveConnections();
      const rooms = wsEngine.getRooms();
      const subscriptions = wsEngine.getSubscriptions();
      const messages = wsEngine.getMessageHistory(100);
      
      // Преобразуем соединения из движка в формат UI
      const engineConnections: Connection[] = activeConnectionsFromEngine.map((conn) => ({
        id: conn.id,
        status: conn.status === 'connected' ? 'connected' : 
                conn.status === 'disconnected' ? 'disconnected' : 'connecting',
        connectedAt: conn.connectedAt ? new Date(conn.connectedAt).toISOString() : undefined,
        messagesSent: conn.messagesSent,
        messagesReceived: conn.messagesReceived,
      }));
      
      // Сохраняем соединения из тест-клиента (включая отключенные)
      let finalConnections = [...engineConnections];
      // Находим все соединения тест-клиента из текущего конфига (включая отключенные)
      const testClientConnections = (currentConfig.connections || []).filter((c: Connection) => c.id.startsWith('test-client-'));
      for (const testClientConn of testClientConnections) {
        // Обновляем или добавляем соединение тест-клиента, сохраняя его статус
        const existingIndex = finalConnections.findIndex(c => c.id === testClientConn.id);
        if (existingIndex >= 0) {
          // Обновляем данные из движка, но сохраняем статус из конфига (может быть disconnected)
          finalConnections[existingIndex] = {
            ...finalConnections[existingIndex],
            status: testClientConn.status, // Сохраняем статус из конфига
          };
        } else {
          // Добавляем новое соединение тест-клиента
          finalConnections.push(testClientConn);
        }
      }
      
      // Преобразуем сообщения из движка в формат UI
      const uiMessages: Message[] = messages.map((msg) => ({
        id: msg.id,
        type: msg.direction === 'sent' ? 'sent' : 'received',
        content: typeof msg.content === 'string' ? msg.content : '[Binary data]',
        timestamp: new Date(msg.timestamp).toISOString(),
      }));
      
      // Объединяем сообщения из движка с сообщениями из тест-клиента (старые сообщения с префиксом msg-)
      const testClientMessages = (currentConfig.messages || []).filter(
        (msg: Message) => msg.id.startsWith('msg-') && !messages.find(m => m.id === msg.id)
      );
      const allMessages = [...uiMessages, ...testClientMessages].slice(-100); // Ограничиваем последними 100
      
      // Обновляем только если данные изменились
      const hasChanges = 
        JSON.stringify(finalConnections) !== JSON.stringify(currentConfig.connections) ||
        JSON.stringify(rooms) !== JSON.stringify(currentConfig.rooms) ||
        JSON.stringify(subscriptions) !== JSON.stringify(currentConfig.subscriptions) ||
        JSON.stringify(allMessages) !== JSON.stringify(currentConfig.messages) ||
        metrics.connectionsTotal !== currentConfig.totalConnections ||
        metrics.connectionsActive !== currentConfig.activeConnections ||
        metrics.messagesTotal !== currentConfig.totalMessages;
      
      if (hasChanges) {
        updateNode(componentId, {
          data: {
            ...currentNode.data,
            config: {
              ...currentConfig,
              connections: finalConnections,
              rooms,
              subscriptions,
              messages: allMessages,
              totalConnections: metrics.connectionsTotal,
              activeConnections: metrics.connectionsActive,
              totalMessages: metrics.messagesTotal,
            },
          },
        });
      }
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [isRunning, wsEngine, componentId, nodes, updateNode]);

  // Валидация полей
  const validateEndpoint = (url: string): string | null => {
    if (!url.trim()) {
      return 'Endpoint is required';
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return 'Endpoint must use ws:// or wss:// protocol';
      }
      return null;
    } catch {
      return 'Invalid endpoint URL format';
    }
  };

  const validatePositiveNumber = (value: number | undefined, fieldName: string, min: number = 1): string | null => {
    if (value === undefined || value === null) {
      return null; // Optional field
    }
    if (isNaN(value) || value < min) {
      return `${fieldName} must be at least ${min}`;
    }
    return null;
  };

  const updateConfig = (updates: Partial<WebSocketConfig>) => {
    // Валидация перед обновлением
    if (updates.endpoint !== undefined) {
      const endpointError = validateEndpoint(updates.endpoint);
      if (endpointError) {
        showValidationError(endpointError);
        return;
      }
    }
    
    if (updates.maxConnections !== undefined) {
      const error = validatePositiveNumber(updates.maxConnections, 'Max connections');
      if (error) {
        showValidationError(error);
        return;
      }
    }
    
    if (updates.maxMessageSize !== undefined) {
      const error = validatePositiveNumber(updates.maxMessageSize, 'Max message size');
      if (error) {
        showValidationError(error);
        return;
      }
    }
    
    if (updates.pingInterval !== undefined) {
      const error = validatePositiveNumber(updates.pingInterval, 'Ping interval', 1);
      if (error) {
        showValidationError(error);
        return;
      }
    }
    
    if (updates.rateLimit) {
      if (updates.rateLimit.messagesPerSecond !== undefined) {
        const error = validatePositiveNumber(updates.rateLimit.messagesPerSecond, 'Messages per second');
        if (error) {
          showValidationError(error);
          return;
        }
      }
      if (updates.rateLimit.connectionsPerSecond !== undefined) {
        const error = validatePositiveNumber(updates.rateLimit.connectionsPerSecond, 'Connections per second');
        if (error) {
          showValidationError(error);
          return;
        }
      }
    }
    
    const newConfig = { ...config, ...updates };
    
    try {
      updateNode(componentId, {
        data: {
          ...node.data,
          config: newConfig,
        },
      });
      
      // Синхронизируем с эмуляционным движком
      if (wsEngine) {
        try {
          wsEngine.updateConfig(newConfig);
        } catch (error) {
          console.error('Error updating WebSocket engine config:', error);
          showError(`Failed to sync configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error updating config:', error);
      showError(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendMessage = () => {
    if (!messageText.trim() || !isConnected || !testClientConnectionId) return;
    
    // Проверка размера сообщения перед отправкой
    const messageSize = new Blob([messageText]).size;
    const maxMessageSizeBytes = (config.maxMessageSize || 1024) * 1024; // KB to bytes
    if (messageSize > maxMessageSizeBytes) {
      showError(`Message size ${(messageSize / 1024).toFixed(2)} KB exceeds maximum ${config.maxMessageSize || 1024} KB`);
      return;
    }
    
    // Обрабатываем сообщение через движок эмуляции
    if (wsEngine) {
      try {
        // Отправляем сообщение от клиента (direction: 'sent')
        const processResult = wsEngine.processIncomingMessage(
          testClientConnectionId,
          messageText,
          {
            source: 'test-client',
            timestamp: Date.now(),
          },
          'sent' // Сообщение отправляется от клиента
        );
        
        if (!processResult.processed) {
          if (processResult.error) {
            showError(processResult.error);
          } else {
            showError('Failed to process message');
          }
          return;
        }
        
        // Сообщение успешно обработано - обновляем UI из движка
        // Метрики и история сообщений уже обновлены в движке
        // Синхронизация произойдет через useEffect
        // НЕ обновляем счетчики вручную - они уже обновлены в движке
        
        setMessageText('');
      } catch (error) {
        console.error('Error sending message:', error);
        showError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Fallback если движок не доступен - просто добавляем в конфиг
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        type: 'sent',
        content: messageText,
        timestamp: new Date().toISOString(),
      };
      
      const updatedConnections = connections.map((conn) =>
        conn.id === testClientConnectionId
          ? { ...conn, messagesSent: (conn.messagesSent || 0) + 1 }
          : conn
      );
      
      updateConfig({ 
        messages: [...messages, newMessage],
        connections: updatedConnections
      });
      setMessageText('');
    }
  };

  const toggleConnection = () => {
    if (!isConnected) {
      // Connect: создаем новое соединение
      const connectionId = `test-client-${Date.now()}`;
      const newConnection: Connection = {
        id: connectionId,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        messagesSent: 0,
        messagesReceived: 0,
      };
      setTestClientConnectionId(connectionId);
      setConnectedEndpoint(endpoint); // Сохраняем endpoint, к которому подключились
      setIsConnected(true);
      updateConfig({ connections: [...connections, newConnection] });
      
      // Создаем соединение в движке эмуляции
      if (wsEngine) {
        try {
          const created = wsEngine.createConnection(connectionId, {
            clientIP: '127.0.0.1',
            userAgent: 'WebSocket Test Client',
          });
          if (!created) {
            // Если не удалось создать в движке, откатываем изменения
            setIsConnected(false);
            setTestClientConnectionId(null);
            setConnectedEndpoint(null);
            showError('Failed to create connection: connection limit reached or authentication failed');
            return;
          }
        } catch (error) {
          console.error('Error creating connection:', error);
          setIsConnected(false);
          setTestClientConnectionId(null);
          setConnectedEndpoint(null);
          showError(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
      }
    } else {
      // Disconnect: закрываем соединение
      if (testClientConnectionId) {
        // Закрываем соединение в движке
        if (wsEngine) {
          try {
            wsEngine.closeConnection(testClientConnectionId);
          } catch (error) {
            console.error('Error closing connection:', error);
            showError(`Failed to close connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        const updatedConnections = connections.map((conn) =>
          conn.id === testClientConnectionId
            ? { ...conn, status: 'disconnected' as const, connectedAt: conn.connectedAt }
            : conn
        );
        updateConfig({ connections: updatedConnections });
        setTestClientConnectionId(null);
      }
      setIsConnected(false);
      setConnectedEndpoint(null); // Очищаем сохраненный endpoint
    }
  };

  // Обработка изменения endpoint при активном соединении
  const handleEndpointChange = (newEndpoint: string) => {
    // Если соединение активно и endpoint изменился - отключаем соединение
    if (isConnected && connectedEndpoint && newEndpoint !== connectedEndpoint) {
      // Автоматически отключаем соединение при изменении endpoint
      let updatedConnections = [...connections];
      if (testClientConnectionId) {
        updatedConnections = connections.map((conn) =>
          conn.id === testClientConnectionId
            ? { ...conn, status: 'disconnected' as const, connectedAt: conn.connectedAt }
            : conn
        );
        setTestClientConnectionId(null);
      }
      setIsConnected(false);
      setConnectedEndpoint(null);
      
      // Обновляем и endpoint, и connections в одном вызове
      updateConfig({ 
        endpoint: newEndpoint,
        connections: updatedConnections
      });
    } else {
      // Просто обновляем endpoint, если соединение не активно
      updateConfig({ endpoint: newEndpoint });
    }
  };

  const addRoom = () => {
    if (!roomName.trim()) return;
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName,
      connections: [],
      messagesBroadcast: 0,
      createdAt: Date.now(),
      description: roomDescription,
    };
    const updatedRooms = [...rooms, newRoom];
    updateConfig({ rooms: updatedRooms });
    
    // Синхронизация с движком происходит в updateConfig
    setRoomName('');
    setRoomDescription('');
  };

  const editRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setRoomDescription(room.description || '');
  };

  const saveRoomEdit = () => {
    if (!editingRoom || !roomName.trim()) return;
    
    const updatedRooms = rooms.map((r) =>
      r.id === editingRoom.id
        ? { ...r, name: roomName, description: roomDescription }
        : r
    );
    updateConfig({ rooms: updatedRooms });
    
    // Синхронизация с движком происходит в updateConfig
    setEditingRoom(null);
    setRoomName('');
    setRoomDescription('');
  };

  const cancelRoomEdit = () => {
    setEditingRoom(null);
    setRoomName('');
    setRoomDescription('');
  };

  const deleteRoom = (roomId: string) => {
    const updatedRooms = rooms.filter((r) => r.id !== roomId);
    updateConfig({ rooms: updatedRooms });
    
    // Синхронизация с движком происходит в updateConfig
  };

  const addSubscription = () => {
    if (!subscriptionTopic.trim()) return;
    const newSubscription: Subscription = {
      id: `sub-${Date.now()}`,
      topic: subscriptionTopic,
      connections: [],
      messagesDelivered: 0,
      createdAt: Date.now(),
      enabled: true,
    };
    const updatedSubscriptions = [...subscriptions, newSubscription];
    updateConfig({ subscriptions: updatedSubscriptions });
    
    // Синхронизация с движком происходит в updateConfig
    setSubscriptionTopic('');
  };

  const deleteSubscription = (subId: string) => {
    const updatedSubscriptions = subscriptions.filter((s) => s.id !== subId);
    updateConfig({ subscriptions: updatedSubscriptions });
    
    // Синхронизация с движком происходит в updateConfig
  };

  const editSubscription = (sub: Subscription) => {
    setEditingSubscription(sub);
    setSubscriptionTopic(sub.topic);
  };

  const saveSubscriptionEdit = () => {
    if (!editingSubscription || !subscriptionTopic.trim()) return;
    
    const updatedSubscriptions = subscriptions.map((s) =>
      s.id === editingSubscription.id
        ? { ...s, topic: subscriptionTopic }
        : s
    );
    updateConfig({ subscriptions: updatedSubscriptions });
    
    // Синхронизация с движком происходит в updateConfig
    setEditingSubscription(null);
    setSubscriptionTopic('');
  };

  const cancelSubscriptionEdit = () => {
    setEditingSubscription(null);
    setSubscriptionTopic('');
  };

  const toggleSubscription = (subId: string) => {
    const updatedSubscriptions = subscriptions.map((s) =>
      s.id === subId ? { ...s, enabled: !s.enabled } : s
    );
    updateConfig({ subscriptions: updatedSubscriptions });
    
    // Синхронизация с движком происходит в updateConfig
  };

  const handleRefresh = () => {
    if (wsEngine && isRunning) {
      // Обновляем данные из эмуляционного движка
      const metrics = wsEngine.getWebSocketMetrics();
      const activeConnections = wsEngine.getActiveConnections();
      const rooms = wsEngine.getRooms();
      const subscriptions = wsEngine.getSubscriptions();
      const messages = wsEngine.getMessageHistory(100);
      
      // Преобразуем данные из движка в формат UI
      const uiConnections: Connection[] = activeConnections.map((conn) => ({
        id: conn.id,
        status: conn.status === 'connected' ? 'connected' : 
                conn.status === 'disconnected' ? 'disconnected' : 'connecting',
        connectedAt: conn.connectedAt ? new Date(conn.connectedAt).toISOString() : undefined,
        messagesSent: conn.messagesSent,
        messagesReceived: conn.messagesReceived,
      }));
      
      // Сохраняем все соединения из тест-клиента (включая отключенные)
      const testClientConnections = connections.filter(c => c.id.startsWith('test-client-'));
      for (const testClientConn of testClientConnections) {
        const existingIndex = uiConnections.findIndex(c => c.id === testClientConn.id);
        if (existingIndex >= 0) {
          // Сохраняем статус из конфига (может быть disconnected)
          uiConnections[existingIndex] = testClientConn;
        } else {
          // Добавляем новое соединение тест-клиента
          uiConnections.push(testClientConn);
        }
      }
      
      const uiRooms: Room[] = rooms.map((room) => ({
        id: room.id,
        name: room.name,
        connections: room.connections,
        messagesBroadcast: room.messagesBroadcast,
        createdAt: room.createdAt,
      }));
      
      const uiSubscriptions: Subscription[] = subscriptions.map((sub) => ({
        id: sub.id,
        topic: sub.topic,
        connections: sub.connections,
        messagesDelivered: sub.messagesDelivered,
        createdAt: sub.createdAt,
        enabled: sub.enabled,
      }));
      
      const uiMessages: Message[] = messages.map((msg) => ({
        id: msg.id,
        type: msg.direction === 'sent' ? 'sent' : 'received',
        content: typeof msg.content === 'string' ? msg.content : '[Binary data]',
        timestamp: new Date(msg.timestamp).toISOString(),
      }));
      
      updateNode(componentId, {
        data: {
          ...node.data,
          config: {
            ...config,
            connections: uiConnections,
            rooms: uiRooms,
            subscriptions: uiSubscriptions,
            messages: uiMessages,
            totalConnections: metrics.connectionsTotal,
            activeConnections: metrics.connectionsActive,
            totalMessages: metrics.messagesTotal,
          },
        },
      });
    } else {
      // Если эмуляция не запущена, просто обновляем UI из текущего конфига
      // Это может быть полезно для очистки кэша или принудительного обновления
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">WebSocket</p>
            <h2 className="text-2xl font-bold text-foreground">WebSocket Server</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time bidirectional communication
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={!isRunning && !wsEngine}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeConnections}</span>
                <span className="text-xs text-muted-foreground">/ {totalConnections} total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalMessages}</span>
                <span className="text-xs text-muted-foreground">exchanged</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
                <Send className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {connections.reduce((sum, c) => sum + (c.messagesSent || 0), 0)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
                <MessageSquare className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {connections.reduce((sum, c) => sum + (c.messagesReceived || 0), 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="client" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="client">
              <Send className="h-4 w-4 mr-2" />
              Test Client
            </TabsTrigger>
            <TabsTrigger value="connections">
              <Network className="h-4 w-4 mr-2" />
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <Home className="h-4 w-4 mr-2" />
              Rooms ({rooms.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <Bell className="h-4 w-4 mr-2" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Test Client</CardTitle>
                <CardDescription>Connect and send messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Endpoint</Label>
                    {isConnected && connectedEndpoint && (
                      <Badge variant="outline" className="text-xs">
                        Connected to: {connectedEndpoint}
                      </Badge>
                    )}
                  </div>
                  <Input
                    value={endpoint}
                    onChange={(e) => handleEndpointChange(e.target.value)}
                    placeholder="ws://localhost:8080/ws"
                  />
                  {isConnected && connectedEndpoint && endpoint !== connectedEndpoint && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                      <XCircle className="h-4 w-4" />
                      <span>Endpoint changed. Connection has been disconnected.</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={toggleConnection}
                    variant={isConnected ? 'destructive' : 'default'}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                  <Badge variant={isConnected ? 'default' : 'outline'}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Send Message</Label>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="font-mono text-sm min-h-[100px]"
                    placeholder='{ "type": "message", "data": "Hello" }'
                    disabled={!isConnected}
                  />
                </div>
                <Button onClick={sendMessage} disabled={!isConnected || !messageText.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Connections</CardTitle>
                <CardDescription>WebSocket client connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No connections yet. Use the Test Client tab to create a connection.
                    </div>
                  ) : (
                    connections.map((conn) => (
                      <Card 
                        key={conn.id} 
                        className={`border-l-4 hover:shadow-md transition-shadow bg-card ${
                          conn.status === 'connected' 
                            ? 'border-l-green-500' 
                            : conn.status === 'disconnected'
                            ? 'border-l-gray-400'
                            : 'border-l-yellow-500'
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                conn.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : 
                                conn.status === 'disconnected' ? 'bg-gray-100 dark:bg-gray-900/30' :
                                'bg-yellow-100 dark:bg-yellow-900/30'
                              }`}>
                                {conn.status === 'connected' ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : conn.status === 'disconnected' ? (
                                  <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                ) : (
                                  <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">
                                  {conn.id.startsWith('test-client-') ? 'Test Client' : conn.id}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant={conn.status === 'connected' ? 'default' : 'outline'}>
                                    {conn.status}
                                  </Badge>
                                  {conn.connectedAt && (
                                    <Badge variant="outline">
                                      {conn.status === 'connected' ? 'Connected' : 'Disconnected'} {new Date(conn.connectedAt).toLocaleString()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Sent:</span>
                              <span className="ml-2 font-semibold">{conn.messagesSent || 0}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Received:</span>
                              <span className="ml-2 font-semibold">{conn.messagesReceived || 0}</span>
                            </div>
                            {conn.lastMessage && (
                              <div>
                                <span className="text-muted-foreground">Last:</span>
                                <span className="ml-2 font-semibold truncate">{conn.lastMessage}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Message History</CardTitle>
                <CardDescription>Sent and received messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <Card key={msg.id} className={`border-l-4 ${
                      msg.type === 'sent' ? 'border-l-green-500 bg-card' :
                      'border-l-blue-500 bg-card'
                    } hover:shadow-md transition-shadow`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              msg.type === 'sent' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                              {msg.type === 'sent' ? (
                                <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold capitalize">{msg.type}</CardTitle>
                              <Badge variant="outline" className="mt-2">
                                {new Date(msg.timestamp).toLocaleString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{msg.content}</pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Rooms</CardTitle>
                    <CardDescription>Group connections into rooms for broadcasting</CardDescription>
                  </div>
                  <Button 
                    onClick={addRoom} 
                    size="sm"
                    disabled={!roomName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Room
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Room name"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !editingRoom && roomName.trim()) {
                        addRoom();
                      } else if (e.key === 'Enter' && editingRoom && roomName.trim()) {
                        saveRoomEdit();
                      } else if (e.key === 'Escape' && editingRoom) {
                        cancelRoomEdit();
                      }
                    }}
                  />
                  <Input
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !editingRoom && roomName.trim()) {
                        addRoom();
                      } else if (e.key === 'Enter' && editingRoom && roomName.trim()) {
                        saveRoomEdit();
                      } else if (e.key === 'Escape' && editingRoom) {
                        cancelRoomEdit();
                      }
                    }}
                  />
                  {editingRoom ? (
                    <>
                      <Button onClick={saveRoomEdit} disabled={!roomName.trim()}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button onClick={cancelRoomEdit} variant="outline">
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={addRoom} disabled={!roomName.trim()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <Card key={room.id} className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{room.name}</CardTitle>
                            {room.description && (
                              <CardDescription className="mt-1">{room.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editRoom(room)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRoom(room.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Connections:</span>
                            <span className="ml-2 font-semibold">{room.connections?.length || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Messages:</span>
                            <span className="ml-2 font-semibold">{room.messagesBroadcast || 0}</span>
                          </div>
                          {room.createdAt && (
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <span className="ml-2 font-semibold">
                                {new Date(room.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {rooms.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No rooms created yet. Create a room to group connections.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Subscribe connections to topics for event delivery</CardDescription>
                  </div>
                  <Button 
                    onClick={addSubscription} 
                    size="sm"
                    disabled={!subscriptionTopic.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subscription
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={subscriptionTopic}
                    onChange={(e) => setSubscriptionTopic(e.target.value)}
                    placeholder="Topic name (e.g., notifications, updates)"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !editingSubscription && subscriptionTopic.trim()) {
                        addSubscription();
                      } else if (e.key === 'Enter' && editingSubscription && subscriptionTopic.trim()) {
                        saveSubscriptionEdit();
                      } else if (e.key === 'Escape' && editingSubscription) {
                        cancelSubscriptionEdit();
                      }
                    }}
                  />
                  {editingSubscription ? (
                    <>
                      <Button onClick={saveSubscriptionEdit} disabled={!subscriptionTopic.trim()}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button onClick={cancelSubscriptionEdit} variant="outline">
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={addSubscription} disabled={!subscriptionTopic.trim()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className={`border-l-4 ${
                      sub.enabled ? 'border-l-green-500' : 'border-l-gray-300'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              sub.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                            }`}>
                              {sub.enabled ? (
                                <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Bell className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{sub.topic}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={sub.enabled ? 'default' : 'outline'}>
                                  {sub.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editSubscription(sub)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSubscription(sub.id)}
                            >
                              {sub.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSubscription(sub.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Subscribers:</span>
                            <span className="ml-2 font-semibold">{sub.connections?.length || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Messages:</span>
                            <span className="ml-2 font-semibold">{sub.messagesDelivered || 0}</span>
                          </div>
                          {sub.createdAt && (
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <span className="ml-2 font-semibold">
                                {new Date(sub.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {subscriptions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No subscriptions created yet. Create a subscription to deliver messages to connections.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Settings</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="ws://localhost:8080/ws"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select value={protocol} onValueChange={(value) => updateConfig({ protocol: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ws">WS (WebSocket)</SelectItem>
                      <SelectItem value="wss">WSS (Secure WebSocket)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Ping/Pong</Label>
                  <Switch 
                    checked={config.enablePingPong ?? true}
                    onCheckedChange={(checked) => updateConfig({ enablePingPong: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ping Interval (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.pingInterval ?? 30}
                    onChange={(e) => updateConfig({ pingInterval: parseInt(e.target.value) || 30 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 1000}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 1000 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Message Size (KB)</Label>
                  <Input 
                    type="number" 
                    value={config.maxMessageSize ?? 1024}
                    onChange={(e) => updateConfig({ maxMessageSize: parseInt(e.target.value) || 1024 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Rooms</Label>
                    <p className="text-xs text-muted-foreground mt-1">Group connections for broadcasting</p>
                  </div>
                  <Switch 
                    checked={config.roomsEnabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ roomsEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Subscriptions</Label>
                    <p className="text-xs text-muted-foreground mt-1">Subscribe to topics for event delivery</p>
                  </div>
                  <Switch 
                    checked={config.subscriptionsEnabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ subscriptionsEnabled: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Authentication</Label>
                      <p className="text-xs text-muted-foreground mt-1">Require authentication for connections</p>
                    </div>
                    <Switch 
                      checked={config.authentication?.enabled ?? false}
                      onCheckedChange={(checked) => updateConfig({ 
                        authentication: { 
                          ...config.authentication, 
                          enabled: checked,
                          method: config.authentication?.method || 'none'
                        } 
                      })}
                    />
                  </div>
                  {config.authentication?.enabled && (
                    <div className="space-y-2 pl-6 border-l-2">
                      <Label>Authentication Method</Label>
                      <Select 
                        value={config.authentication?.method || 'none'}
                        onValueChange={(value: 'none' | 'token' | 'apiKey' | 'basic') => 
                          updateConfig({ 
                            authentication: { 
                              ...config.authentication, 
                              method: value 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="token">Token</SelectItem>
                          <SelectItem value="apiKey">API Key</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                      </Select>
                      {config.authentication?.method === 'token' && (
                        <div className="space-y-2">
                          <Label>Token</Label>
                          <Input
                            type="password"
                            value={config.authentication?.token || ''}
                            onChange={(e) => updateConfig({ 
                              authentication: { 
                                ...config.authentication, 
                                token: e.target.value 
                              } 
                            })}
                            placeholder="Enter token"
                          />
                        </div>
                      )}
                      {config.authentication?.method === 'apiKey' && (
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={config.authentication?.apiKey || ''}
                            onChange={(e) => updateConfig({ 
                              authentication: { 
                                ...config.authentication, 
                                apiKey: e.target.value 
                              } 
                            })}
                            placeholder="Enter API key"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rate Limiting</Label>
                      <p className="text-xs text-muted-foreground mt-1">Limit message and connection rates</p>
                    </div>
                    <Switch 
                      checked={config.rateLimit?.enabled ?? false}
                      onCheckedChange={(checked) => updateConfig({ 
                        rateLimit: { 
                          ...config.rateLimit, 
                          enabled: checked,
                          messagesPerSecond: config.rateLimit?.messagesPerSecond || 1000,
                          connectionsPerSecond: config.rateLimit?.connectionsPerSecond || 100
                        } 
                      })}
                    />
                  </div>
                  {config.rateLimit?.enabled && (
                    <div className="space-y-2 pl-6 border-l-2">
                      <div className="space-y-2">
                        <Label>Messages Per Second</Label>
                        <Input 
                          type="number" 
                          value={config.rateLimit?.messagesPerSecond || 1000}
                          onChange={(e) => updateConfig({ 
                            rateLimit: { 
                              ...config.rateLimit, 
                              messagesPerSecond: parseInt(e.target.value) || 1000 
                            } 
                          })}
                          min={1} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Connections Per Second</Label>
                        <Input 
                          type="number" 
                          value={config.rateLimit?.connectionsPerSecond || 100}
                          onChange={(e) => updateConfig({ 
                            rateLimit: { 
                              ...config.rateLimit, 
                              connectionsPerSecond: parseInt(e.target.value) || 100 
                            } 
                          })}
                          min={1} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

