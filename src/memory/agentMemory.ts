/**
 * AgentMemory - 简单内存存储封装
 * 用于跨会话记忆存储
 */

export interface MemoryEntry {
  id: string;
  type: 'task' | 'action' | 'result' | 'error' | 'context';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  tags?: string[];
}

export class AgentMemory {
  private entries: Map<string, MemoryEntry> = new Map();
  private namespace: string;

  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }

  async put(entry: MemoryEntry): Promise<void> {
    const key = `${entry.type}_${entry.id}`;
    this.entries.set(key, entry);
    console.log(`[AgentMemory] Stored: ${key}`);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    return entry || null;
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
    console.log(`[AgentMemory] Deleted: ${id}`);
  }

  async list(): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values());
  }

  async recordTask(task: string, result: any): Promise<void> {
    const entry: MemoryEntry = {
      id: `task_${Date.now()}`,
      type: 'task',
      content: task,
      metadata: { result },
      timestamp: Date.now(),
      tags: ['task'],
    };
    await this.put(entry);
  }

  async recordAction(action: string, params: any, result: any): Promise<void> {
    const entry: MemoryEntry = {
      id: `action_${Date.now()}`,
      type: 'action',
      content: action,
      metadata: { params, result },
      timestamp: Date.now(),
      tags: ['action'],
    };
    await this.put(entry);
  }

  async recordError(error: string, context: any): Promise<void> {
    const entry: MemoryEntry = {
      id: `error_${Date.now()}`,
      type: 'error',
      content: error,
      metadata: { context },
      timestamp: Date.now(),
      tags: ['error'],
    };
    await this.put(entry);
  }

  async getRecentTasks(limit: number = 5): Promise<MemoryEntry[]> {
    const all = await this.list();
    return all
      .filter((e) => e.type === 'task')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getRecentErrors(limit: number = 5): Promise<MemoryEntry[]> {
    const all = await this.list();
    return all
      .filter((e) => e.type === 'error')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    console.log('[AgentMemory] Cleared all entries');
  }

  size(): number {
    return this.entries.size;
  }
}

let memoryInstance: AgentMemory | null = null;

export function getMemory(): AgentMemory {
  if (!memoryInstance) {
    memoryInstance = new AgentMemory();
  }
  return memoryInstance;
}

export function createMemory(namespace?: string): AgentMemory {
  return new AgentMemory(namespace);
}

export default AgentMemory;
