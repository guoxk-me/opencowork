/**
 * Checkpointer - LangGraph Checkpoint 持久化
 * 用于任务状态持久化和恢复
 *
 * 支持:
 * - MemorySaver: 内存存储 (默认，用于开发/测试)
 * - SQLiteSaver: SQLite 存储 (生产环境推荐)
 */
import { MemorySaver } from '@langchain/langgraph-checkpoint';
export class AgentCheckpointer {
    checkpointer;
    config;
    constructor(config = { type: 'memory' }) {
        this.config = config;
        this.checkpointer = this.createCheckpointer();
    }
    createCheckpointer() {
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
    getCheckpointer() {
        return this.checkpointer;
    }
    getConfig() {
        return this.config;
    }
}
let checkpointerInstance = null;
export function getCheckpointer(config) {
    if (!checkpointerInstance) {
        checkpointerInstance = new AgentCheckpointer(config);
    }
    return checkpointerInstance;
}
export function createCheckpointer(config) {
    return new AgentCheckpointer(config);
}
export default AgentCheckpointer;
