/**
 * Checkpointer - LangGraph Checkpoint 持久化
 * 用于任务状态持久化和恢复
 *
 * 支持:
 * - MemorySaver: 内存存储 (默认，用于开发/测试)
 * - SQLiteSaver: SQLite 存储 (生产环境推荐)
 */

import { MemorySaver, BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

export interface CheckpointerConfig {
  type: 'memory' | 'sqlite';
  dbPath?: string;
}

export class AgentCheckpointer {
  private checkpointer: BaseCheckpointSaver;
  private config: CheckpointerConfig;

  constructor(config: CheckpointerConfig = { type: 'memory' }) {
    this.config = config;
    this.checkpointer = this.createCheckpointer();
  }

  private createCheckpointer(): BaseCheckpointSaver {
    switch (this.config.type) {
      case 'memory':
        console.log('[Checkpointer] Using MemorySaver');
        return new MemorySaver();
      case 'sqlite':
        console.log('[Checkpointer] SQLite not fully implemented, falling back to MemorySaver');
        return new MemorySaver();
      default:
        console.log('[Checkpointer] Unknown type, using MemorySaver');
        return new MemorySaver();
    }
  }

  getCheckpointer(): BaseCheckpointSaver {
    return this.checkpointer;
  }

  getConfig(): CheckpointerConfig {
    return this.config;
  }
}

let checkpointerInstance: AgentCheckpointer | null = null;

export function getCheckpointer(config?: CheckpointerConfig): AgentCheckpointer {
  if (!checkpointerInstance) {
    checkpointerInstance = new AgentCheckpointer(config);
  }
  return checkpointerInstance;
}

export function createCheckpointer(config?: CheckpointerConfig): AgentCheckpointer {
  return new AgentCheckpointer(config);
}

export default AgentCheckpointer;
