import type { DatabaseConnection } from '../database/connection.js';

export interface AdapterCapabilities {
  canCapture: boolean;
  canBounce: boolean;
  canPreview: boolean;
  hasMidi: boolean;
}

export interface AdapterContext {
  db: DatabaseConnection;
  mediaDir: string;
  tempDir: string;
  emit: (channel: string, data: unknown) => void;
}

export interface HardwareAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  initialize(context: AdapterContext): Promise<void>;
  teardown(): Promise<void>;
  getStatus(): Promise<{ connected: boolean; deviceInfo?: Record<string, unknown> }>;
}

export class AdapterRegistry {
  private adapters = new Map<string, HardwareAdapter>();
  private context: AdapterContext | null = null;

  setContext(context: AdapterContext): void {
    this.context = context;
  }

  register(adapter: HardwareAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  async initialize(adapterId: string): Promise<void> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter not found: ${adapterId}`);
    if (!this.context) throw new Error('Context not set');

    await adapter.initialize(this.context);
  }

  async teardown(adapterId: string): Promise<void> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter not found: ${adapterId}`);

    await adapter.teardown();
  }

  getAdapter(id: string): HardwareAdapter | undefined {
    return this.adapters.get(id);
  }

  listAdapters(): Array<{ id: string; name: string; capabilities: AdapterCapabilities }> {
    return Array.from(this.adapters.values()).map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      capabilities: adapter.capabilities,
    }));
  }

  async getStatus(adapterId: string): Promise<{ connected: boolean; deviceInfo?: Record<string, unknown> }> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter not found: ${adapterId}`);

    return adapter.getStatus();
  }
}
