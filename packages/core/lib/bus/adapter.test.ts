import { describe, it, expect, vi } from 'vitest';
import { MockMQTTAdapter, MockOCPPAdapter, UniversalBus } from './adapter';

describe('ProtocolAdapters and UniversalBus', () => {
  it('should publish and subscribe to MQTT topics', async () => {
    const adapter = new MockMQTTAdapter();
    await adapter.connect();

    const handler = vi.fn();
    await adapter.subscribe('test/topic', handler);
    await adapter.publish('test/topic', { data: 123 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'test/topic',
        payload: { data: 123 },
      })
    );

    await adapter.disconnect();
  });

  it('should handle OCPP actions', async () => {
    const adapter = new MockOCPPAdapter();
    await adapter.connect();

    const handler = vi.fn();
    await adapter.subscribe('BootNotification', handler);
    await adapter.publish('BootNotification', { chargePointModel: 'EVB-1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'BootNotification',
        payload: { chargePointModel: 'EVB-1' },
      })
    );
  });

  it('UniversalBus should route messages through registered adapters', async () => {
    const bus = new UniversalBus();
    const mqtt = new MockMQTTAdapter();
    await mqtt.connect();

    bus.registerAdapter('mqtt', mqtt);

    const handler = vi.fn();
    await mqtt.subscribe('broadcast', handler);

    await bus.publishAll('broadcast', { msg: 'hello' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
