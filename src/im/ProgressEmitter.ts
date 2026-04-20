import { EventEmitter } from 'events';
import { IMBot, ProgressEvent, IMNotification } from './types';

type ProgressListener = (data: ProgressEvent) => void;

interface TaskBinding {
  userId: string;
  conversationId: string;
  chatType?: string;
  replyTargetId?: string;
}

export class ProgressEmitter extends EventEmitter {
  private progressListeners: Map<string, Set<ProgressListener>> = new Map();
  private imBot: IMBot | null = null;
  private taskBindingMap: Map<string, TaskBinding> = new Map();

  setIMBot(bot: IMBot): void {
    this.imBot = bot;
  }

  setUserBinding(taskId: string, binding: TaskBinding): void {
    this.taskBindingMap.set(taskId, binding);
  }

  subscribe(taskId: string, listener: ProgressListener): () => void {
    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, new Set());
    }
    this.progressListeners.get(taskId)!.add(listener);

    return () => {
      this.progressListeners.get(taskId)?.delete(listener);
      if (this.progressListeners.get(taskId)?.size === 0) {
        this.progressListeners.delete(taskId);
        this.taskBindingMap.delete(taskId);
      }
    };
  }

  emitProgress(event: ProgressEvent): void {
    const listeners = this.progressListeners.get(event.taskId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }

    if (this.imBot && event.status !== 'pending') {
      this.pushToIM(event);
    }
  }

  private async pushToIM(event: ProgressEvent): Promise<void> {
    if (!this.imBot) return;

    const statusText =
      {
        pending: '⏳ 待执行',
        executing: `🔄 执行中: ${event.message || ''}`,
        completed: '✅ 任务完成',
        failed: '❌ 任务失败',
      }[event.status] || `未知状态: ${event.status}`;

    const notification: IMNotification = {
      title: event.taskId,
      content: statusText,
      extra: {
        taskId: event.taskId,
        step: event.step,
        total: event.total,
      },
    };

    const binding = this.taskBindingMap.get(event.taskId);
    if (binding) {
      try {
        await this.imBot.sendMessage(
          binding.replyTargetId || binding.conversationId,
          `📋 ${notification.title}\n\n${notification.content}`,
          binding.chatType
        );
        console.log('[ProgressEmitter] Notification sent for task:', event.taskId);
      } catch (error) {
        console.error('[ProgressEmitter] Send message failed:', error);
      }
    }
  }

  clearTask(taskId: string): void {
    this.progressListeners.delete(taskId);
    this.taskBindingMap.delete(taskId);
  }

  clearAll(): void {
    this.progressListeners.clear();
    this.taskBindingMap.clear();
  }
}

let progressEmitterInstance: ProgressEmitter | null = null;

export function getProgressEmitter(): ProgressEmitter {
  if (!progressEmitterInstance) {
    progressEmitterInstance = new ProgressEmitter();
  }
  return progressEmitterInstance;
}
