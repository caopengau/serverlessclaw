export interface Message {
  topic: string;
  payload: any;
  timestamp: number;
}

export interface ProtocolAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, handler: (msg: Message) => void): Promise<void>;
  unsubscribe(topic: string, handler: (msg: Message) => void): Promise<void>;
}

export class MockMQTTAdapter implements ProtocolAdapter {
  private handlers: Map<string, Array<(msg: Message) => void>> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log("Connected to Mock MQTT broker");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.handlers.clear();
    console.log("Disconnected from Mock MQTT broker");
  }

  async publish(topic: string, message: any): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    const msg: Message = { topic, payload: message, timestamp: Date.now() };
    const topicHandlers = this.handlers.get(topic) || [];
    topicHandlers.forEach(handler => handler(msg));
  }

  async subscribe(topic: string, handler: (msg: Message) => void): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    const current = this.handlers.get(topic) || [];
    this.handlers.set(topic, [...current, handler]);
  }

  async unsubscribe(topic: string, handler: (msg: Message) => void): Promise<void> {
    if (!this.connected) return;
    const current = this.handlers.get(topic) || [];
    this.handlers.set(topic, current.filter(h => h !== handler));
  }
}

export class MockOCPPAdapter implements ProtocolAdapter {
  // Simplified OCPP representation as a pub/sub mechanism
  private handlers: Map<string, Array<(msg: Message) => void>> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log("Connected to Mock OCPP Central System");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.handlers.clear();
    console.log("Disconnected from Mock OCPP Central System");
  }

  async publish(action: string, payload: any): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    const msg: Message = { topic: action, payload, timestamp: Date.now() };
    const topicHandlers = this.handlers.get(action) || [];
    topicHandlers.forEach(handler => handler(msg));
  }

  async subscribe(action: string, handler: (msg: Message) => void): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    const current = this.handlers.get(action) || [];
    this.handlers.set(action, [...current, handler]);
  }

  async unsubscribe(action: string, handler: (msg: Message) => void): Promise<void> {
    if (!this.connected) return;
    const current = this.handlers.get(action) || [];
    this.handlers.set(action, current.filter(h => h !== handler));
  }
}

export class UniversalBus {
  private adapters: Map<string, ProtocolAdapter> = new Map();

  registerAdapter(name: string, adapter: ProtocolAdapter) {
    this.adapters.set(name, adapter);
  }

  getAdapter(name: string): ProtocolAdapter | undefined {
    return this.adapters.get(name);
  }

  async publishAll(topic: string, message: any): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.publish(topic, message);
      } catch (e) {
        console.error(`Failed to publish on adapter`, e);
      }
    }
  }
}
