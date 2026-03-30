// src/scheduler/scheduler.ts
import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { TaskStore } from './taskStore';
import { TaskQueue } from './taskQueue';
import { TaskExecutor } from './taskExecutor';
import { ExecutorMode } from './types';
const DEFAULT_CONFIG = {
    maxConcurrentTasks: 3,
    defaultTimeout: 300000,
    executorMode: ExecutorMode.STANDALONE,
};
export class Scheduler extends EventEmitter {
    config;
    taskStore;
    taskQueue;
    taskExecutor;
    cronJobs = new Map();
    intervalTimers = new Map();
    isRunning = false;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.taskStore = new TaskStore();
        this.taskQueue = new TaskQueue({ maxConcurrent: this.config.maxConcurrentTasks });
        this.taskExecutor = new TaskExecutor({ mode: this.config.executorMode });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.taskQueue.on('task:completed', async (task, result) => {
            await this.handleTaskComplete(task, result);
        });
        this.taskQueue.on('task:failed', async (task, error) => {
            await this.handleTaskComplete(task, {
                taskId: task.scheduledTaskId,
                status: 'failed',
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0,
                error: error.message,
                retryCount: task.retryCount,
            });
        });
    }
    async handleTaskComplete(task, result) {
        const scheduledTask = task.scheduledTask;
        await this.taskStore.updateExecutionStatus(scheduledTask.id, result.status, result.error);
        if (scheduledTask.schedule.type === 'one-time') {
            await this.taskStore.update(scheduledTask.id, { enabled: false });
            await this.unscheduleTask(scheduledTask.id);
            console.log(`[Scheduler] One-time task ${scheduledTask.id} completed and auto-disabled`);
        }
        this.emit('task:statusChanged', {
            taskId: scheduledTask.id,
            status: result.status,
            lastRun: Date.now(),
        });
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.taskQueue.setExecutor(async (task) => {
            return await this.taskExecutor.execute(task);
        });
        const tasks = await this.taskStore.getAllEnabled();
        for (const task of tasks) {
            await this.scheduleTask(task);
        }
        this.taskQueue.start();
        console.log('[Scheduler] Started with', tasks.length, 'scheduled tasks');
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        for (const [id, job] of this.cronJobs) {
            job.stop();
        }
        this.cronJobs.clear();
        for (const [id, timer] of this.intervalTimers) {
            clearInterval(timer);
        }
        this.intervalTimers.clear();
        this.taskQueue.stop();
        console.log('[Scheduler] Stopped');
    }
    async addTask(input) {
        const newTask = await this.taskStore.create(input);
        if (newTask.enabled) {
            await this.scheduleTask(newTask);
        }
        return newTask;
    }
    async updateTask(id, updates) {
        await this.unscheduleTask(id);
        const updatedTask = await this.taskStore.update(id, updates);
        if (updatedTask && updatedTask.enabled) {
            await this.scheduleTask(updatedTask);
        }
        return updatedTask;
    }
    async deleteTask(id) {
        await this.unscheduleTask(id);
        return await this.taskStore.delete(id);
    }
    async getAllTasks() {
        return await this.taskStore.getAll();
    }
    async getTask(id) {
        return await this.taskStore.get(id);
    }
    async triggerTask(id) {
        const task = await this.taskStore.get(id);
        if (!task) {
            throw new Error(`Task not found: ${id}`);
        }
        await this.enqueueTask(task);
    }
    async scheduleTask(task) {
        if (!task.enabled)
            return;
        const nextRun = this.calculateNextRun(task);
        await this.taskStore.update(task.id, { nextRun });
        switch (task.schedule.type) {
            case 'cron':
                this.scheduleCronTask(task);
                break;
            case 'interval':
                this.scheduleIntervalTask(task);
                break;
            case 'one-time':
                this.scheduleOneTimeTask(task);
                break;
        }
    }
    scheduleCronTask(task) {
        if (!task.schedule.cron)
            return;
        const job = cron.schedule(task.schedule.cron, async () => {
            await this.enqueueTask(task);
        }, {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        this.cronJobs.set(task.id, job);
    }
    scheduleIntervalTask(task) {
        if (!task.schedule.intervalMs)
            return;
        const timer = setInterval(async () => {
            await this.enqueueTask(task);
        }, task.schedule.intervalMs);
        this.intervalTimers.set(task.id, timer);
    }
    scheduleOneTimeTask(task) {
        if (!task.schedule.startTime)
            return;
        const delay = task.schedule.startTime - Date.now();
        if (delay <= 0)
            return;
        const timer = setTimeout(async () => {
            await this.enqueueTask(task);
        }, delay);
        this.intervalTimers.set(task.id, timer);
    }
    async unscheduleTask(id) {
        const cronJob = this.cronJobs.get(id);
        if (cronJob) {
            cronJob.stop();
            this.cronJobs.delete(id);
        }
        const intervalTimer = this.intervalTimers.get(id);
        if (intervalTimer) {
            clearInterval(intervalTimer);
            this.intervalTimers.delete(id);
        }
    }
    async enqueueTask(task) {
        const queuedTask = {
            id: `qt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            scheduledTaskId: task.id,
            scheduledTask: task,
            priority: this.calculatePriority(task),
            enqueuedAt: Date.now(),
            executeAt: Date.now(),
            retryCount: 0,
        };
        await this.taskQueue.enqueue(queuedTask);
    }
    calculateNextRun(task) {
        const now = Date.now();
        switch (task.schedule.type) {
            case 'cron':
                return now + 60000;
            case 'interval':
                return now + (task.schedule.intervalMs || 0);
            case 'one-time':
                return task.schedule.startTime;
        }
    }
    calculatePriority(task) {
        if (task.lastStatus === 'failed') {
            return 1;
        }
        return 2;
    }
}
let schedulerInstance = null;
export function getScheduler(config) {
    if (!schedulerInstance) {
        schedulerInstance = new Scheduler(config);
    }
    return schedulerInstance;
}
export function createScheduler(config) {
    schedulerInstance = new Scheduler(config);
    return schedulerInstance;
}
