import { RuntimeEvent } from '../../shared/protocol';

export type RuntimeEventListener = (event: RuntimeEvent) => void;

export interface RuntimeEventBusOptions {
  maxEventsPerRun?: number;
  maxRuns?: number;
}

const DEFAULT_MAX_EVENTS_PER_RUN = 500;
const DEFAULT_MAX_RUNS = 200;

export class RuntimeEventBus {
  private readonly maxEventsPerRun: number;
  private readonly maxRuns: number;
  private readonly eventsByRun = new Map<string, RuntimeEvent[]>();
  private readonly runOrder: string[] = [];
  private readonly listenersByRun = new Map<string, Set<RuntimeEventListener>>();
  private readonly globalListeners = new Set<RuntimeEventListener>();

  constructor(options: RuntimeEventBusOptions = {}) {
    this.maxEventsPerRun = options.maxEventsPerRun || DEFAULT_MAX_EVENTS_PER_RUN;
    this.maxRuns = options.maxRuns || DEFAULT_MAX_RUNS;
  }

  emit(event: RuntimeEvent): void {
    this.appendEvent(event);
    this.notify(event);
  }

  subscribe(runId: string, listener: RuntimeEventListener): () => void {
    let listeners = this.listenersByRun.get(runId);
    if (!listeners) {
      listeners = new Set();
      this.listenersByRun.set(runId, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        this.listenersByRun.delete(runId);
      }
    };
  }

  subscribeAll(listener: RuntimeEventListener): () => void {
    this.globalListeners.add(listener);

    return () => {
      this.globalListeners.delete(listener);
    };
  }

  listEvents(runId: string): RuntimeEvent[] {
    return [...(this.eventsByRun.get(runId) || [])];
  }

  clearRun(runId: string): void {
    this.eventsByRun.delete(runId);
    this.listenersByRun.delete(runId);
    const index = this.runOrder.indexOf(runId);
    if (index >= 0) {
      this.runOrder.splice(index, 1);
    }
  }

  clear(): void {
    this.eventsByRun.clear();
    this.runOrder.length = 0;
    this.listenersByRun.clear();
    this.globalListeners.clear();
  }

  private appendEvent(event: RuntimeEvent): void {
    if (!this.eventsByRun.has(event.runId)) {
      this.eventsByRun.set(event.runId, []);
      this.runOrder.push(event.runId);
      this.evictOldRuns();
    }

    const events = this.eventsByRun.get(event.runId)!;
    events.push(event);
    if (events.length > this.maxEventsPerRun) {
      events.splice(0, events.length - this.maxEventsPerRun);
    }
  }

  private evictOldRuns(): void {
    while (this.runOrder.length > this.maxRuns) {
      const oldestRunId = this.runOrder.shift();
      if (oldestRunId) {
        this.eventsByRun.delete(oldestRunId);
        this.listenersByRun.delete(oldestRunId);
      }
    }
  }

  private notify(event: RuntimeEvent): void {
    const listeners = this.listenersByRun.get(event.runId);
    if (listeners) {
      for (const listener of listeners) {
        this.safeNotify(listener, event);
      }
    }

    for (const listener of this.globalListeners) {
      this.safeNotify(listener, event);
    }
  }

  private safeNotify(listener: RuntimeEventListener, event: RuntimeEvent): void {
    try {
      listener(event);
    } catch (error) {
      // Listener failures must not break runtime event delivery for other clients.
      // eslint-disable-next-line no-console
      console.warn('[RuntimeEventBus] Listener failed:', error);
    }
  }
}

let runtimeEventBus: RuntimeEventBus | null = null;

export function getRuntimeEventBus(): RuntimeEventBus {
  if (!runtimeEventBus) {
    runtimeEventBus = new RuntimeEventBus();
  }
  return runtimeEventBus;
}

export function resetRuntimeEventBus(): void {
  runtimeEventBus?.clear();
  runtimeEventBus = null;
}
