// src/scheduler/taskQueue.ts
import { EventEmitter } from 'events';
const DEFAULT_CONFIG = {
    maxConcurrent: 3,
    maxQueueSize: 100,
};
export class TaskQueue extends EventEmitter {
    config;
    queue = [];
    runningCount = 0;
    isProcessing = false;
    executor;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    setExecutor(executor) {
        this.executor = executor;
    }
    start() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        this.processQueue();
    }
    stop() {
        this.isProcessing = false;
    }
    async enqueue(task) {
        if (this.queue.length >= this.config.maxQueueSize) {
            console.warn('[TaskQueue] Queue full, rejecting task:', task.id);
            throw new Error('Task queue is full');
        }
        const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
        if (insertIndex === -1) {
            this.queue.push(task);
        }
        else {
            this.queue.splice(insertIndex, 0, task);
        }
        console.log('[TaskQueue] Enqueued task:', task.scheduledTaskId, 'Priority:', task.priority);
    }
    dequeue() {
        return this.queue.shift();
    }
    size() {
        return this.queue.length;
    }
    getRunningCount() {
        return this.runningCount;
    }
    async processQueue() {
        if (!this.isProcessing)
            return;
        while (this.isProcessing &&
            this.runningCount < this.config.maxConcurrent &&
            this.queue.length > 0 &&
            this.executor) {
            const task = this.peekNextExecutable();
            if (!task)
                break;
            this.runningCount++;
            const dequeuedTask = this.dequeue();
            if (dequeuedTask) {
                this.executeTask(dequeuedTask).finally(() => {
                    this.runningCount--;
                    this.processQueue();
                });
            }
        }
        if (this.isProcessing) {
            setTimeout(() => this.processQueue(), 100);
        }
    }
    peekNextExecutable() {
        const now = Date.now();
        return this.queue.find((task) => task.executeAt <= now);
    }
    async executeTask(task) {
        console.log('[TaskQueue] Executing task:', task.scheduledTaskId, 'Retry:', task.retryCount);
        let result;
        try {
            if (this.executor) {
                result = await this.executor(task);
            }
            else {
                throw new Error('No executor configured');
            }
            if (result.status === 'success') {
                this.emit('task:completed', task, result);
            }
            else {
                this.emit('task:failed', task, new Error(result.error || 'Task failed'));
            }
        }
        catch (error) {
            this.emit('task:failed', task, error instanceof Error ? error : new Error(String(error)));
        }
    }
}
