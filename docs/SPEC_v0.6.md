# OpenCowork v0.6 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.6       |
| 更新日期 | 2026-03-30 |
| 状态     | 规划中     |
| 基于PRD  | v2.7       |
| 前置版本 | v0.5       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
4. [文件结构](#4-文件结构)
5. [实施计划](#5-实施计划)
6. [成功指标](#6-成功指标)

---

## 1. 版本目标

**目标**: 定时任务系统 + 调度优化

### 核心目标

| 目标         | 说明                               |
| ------------ | ---------------------------------- |
| **定时调度** | 支持 Cron 表达式、间隔、一次性任务 |
| **任务队列** | 优先级队列、重试机制、并发控制     |
| **UI 集成**  | 定时任务面板、可视化 Cron 配置     |

### 版本功能

| 功能             | 周期       | 交付标准           |
| ---------------- | ---------- | ------------------ |
| **定时任务核心** | Week 25-26 | Cron调度、持久化   |
| **任务队列**     | Week 27-28 | 重试机制、并发控制 |
| **UI 集成**      | Week 29-30 | 任务面板、Cron配置 |

### 与 v0.5 关系

| 组件     | v0.5 实现            | v0.6 增强            |
| -------- | -------------------- | -------------------- |
| 任务历史 | TaskHistory SQLite   | 定时任务执行记录写入 |
| 任务执行 | MainAgent            | 定时触发执行         |
| 任务存储 | SQLite (TaskHistory) | 复用存储定时任务配置 |
| Skill    | SkillLoader          | 定时任务可调用 Skill |

---

## 2. 技术架构

### 2.1 技术选型对比

| 项目     | 原 PRD 规划 | 调整后                  | 理由                         |
| -------- | ----------- | ----------------------- | ---------------------------- |
| 任务队列 | BullMQ      | node-cron + 内存队列    | 桌面应用无需 Redis，简化依赖 |
| 持久化   | 新建        | 复用 TaskHistory SQLite | 避免重复建设                 |
| 时区     | 未明确      | 系统本地时区            | 简化设计，单用户场景足够     |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Scheduler Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Scheduler    │  │   TaskQueue    │                   │
│  │   (调度器)      │  │   (任务队列)    │                   │
│  └────────┬────────┘  └────────┬────────┘               │
│           │                       │                          │
│           ▼                       ▼                          │
│  ┌─────────────────────────────────────────────┐            │
│  │              TaskExecutor                      │            │
│  │  • 执行定时任务                              │            │
│  │  • 调用 TaskPlanner 分解任务                 │            │
│  │  • 调用 SkillRunner 执行 Skill               │            │
│  │  • 写入 TaskHistory                          │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Storage Layer                              │ │
│  │  ┌─────────────────┐    ┌─────────────────┐           │ │
│  │  │  ScheduledTask  │    │  TaskHistory   │           │ │
│  │  │  (SQLite)       │    │  (SQLite)      │           │ │
│  │  └─────────────────┘    └─────────────────┘           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 模块职责

| 模块         | 职责                                          |
| ------------ | --------------------------------------------- |
| Scheduler    | 管理所有定时任务，Cron 表达式解析，到期触发   |
| TaskQueue    | 任务队列管理，优先级排序，重试逻辑，并发控制  |
| TaskStore    | 定时任务配置的 SQLite 持久化                  |
| TaskExecutor | 执行定时任务，调用 TaskPlanner 和 SkillRunner |

---

## 3. 核心模块设计

### 3.1 数据模型

```typescript
// src/scheduler/types.ts

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // 调度配置
  schedule: {
    type: 'cron' | 'interval' | 'one-time';
    cron?: string; // Cron 表达式 (本地时区)
    intervalMs?: number; // 间隔 (毫秒)
    startTime?: number; // 一次性任务开始时间 (timestamp)
  };

  // 执行配置
  execution: {
    taskDescription: string; // 实际执行的任务描述
    timeout: number; // 超时 (ms)
    maxRetries: number; // 最大重试次数
    retryDelayMs: number; // 重试间隔 (ms)
  };

  // 状态
  lastRun?: number; // 上次执行时间
  nextRun?: number; // 下次执行时间
  lastStatus?: 'success' | 'failed' | 'cancelled';
  lastError?: string; // 上次错误信息
  runCount: number; // 累计执行次数

  createdAt: number;
  updatedAt: number;
}

export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  ONE_TIME = 'one-time',
}

export interface QueuedTask {
  id: string;
  scheduledTaskId: string;
  scheduledTask: ScheduledTask;
  priority: number;
  enqueuedAt: number;
  executeAt: number;
  retryCount: number;
}

export interface TaskExecutionResult {
  taskId: string;
  status: 'success' | 'failed' | 'cancelled';
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  retryCount: number;
}
```

### 3.2 Scheduler 模块

```typescript
// src/scheduler/scheduler.ts

import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { ScheduledTask } from './types';
import { TaskStore } from './taskStore';
import { TaskQueue, TaskQueueConfig } from './taskQueue';
import { TaskExecutor } from './taskExecutor';

export interface SchedulerConfig {
  maxConcurrentTasks: number; // 最大并发任务数，默认 3
  defaultTimeout: number; // 默认超时 (ms)，默认 300000 (5分钟)
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrentTasks: 3,
  defaultTimeout: 300000,
};

export class Scheduler extends EventEmitter {
  private config: SchedulerConfig;
  private taskStore: TaskStore;
  private taskQueue: TaskQueue;
  private taskExecutor: TaskExecutor;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(config?: Partial<SchedulerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.taskStore = new TaskStore();
    this.taskQueue = new TaskQueue({ maxConcurrent: this.config.maxConcurrentTasks });
    this.taskExecutor = new TaskExecutor();

    // 监听任务完成事件
    this.setupEventHandlers();
  }

  // 设置事件处理器
  private setupEventHandlers(): void {
    this.taskQueue.on('task:completed', async (task: QueuedTask, result: TaskExecutionResult) => {
      await this.handleTaskComplete(task, result);
    });

    this.taskQueue.on('task:failed', async (task: QueuedTask, error: Error) => {
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

  // 处理任务完成
  private async handleTaskComplete(task: QueuedTask, result: TaskExecutionResult): Promise<void> {
    const scheduledTask = task.scheduledTask;

    // 更新执行状态
    await this.taskStore.updateExecutionStatus(scheduledTask.id, result.status, result.error);

    // 一次性任务执行后自动禁用
    if (scheduledTask.schedule.type === 'one-time') {
      await this.taskStore.update(scheduledTask.id, { enabled: false });
      await this.unscheduleTask(scheduledTask.id);
      console.log(`[Scheduler] One-time task ${scheduledTask.id} completed and auto-disabled`);
    }

    // 发送通知事件 (供 UI 使用)
    this.emit('task:statusChanged', {
      taskId: scheduledTask.id,
      status: result.status,
      lastRun: Date.now(),
    });
  }

  // 启动调度器
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 设置任务执行器
    this.taskQueue.setExecutor(async (task) => {
      return await this.taskExecutor.execute(task);
    });

    // 加载所有启用的定时任务
    const tasks = await this.taskStore.getAllEnabled();
    for (const task of tasks) {
      await this.scheduleTask(task);
    }

    // 启动任务队列处理器
    this.taskQueue.start();

    console.log('[Scheduler] Started with', tasks.length, 'scheduled tasks');
  }

  // 停止调度器
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // 停止所有 cron 任务
    for (const [id, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();

    // 清除所有 interval 定时器
    for (const [id, timer] of this.intervalTimers) {
      clearInterval(timer);
    }
    this.intervalTimers.clear();

    // 停止任务队列
    this.taskQueue.stop();

    console.log('[Scheduler] Stopped');
  }

  // 添加定时任务
  async addTask(
    task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScheduledTask> {
    const newTask = await this.taskStore.create(task);
    if (newTask.enabled) {
      await this.scheduleTask(newTask);
    }
    return newTask;
  }

  // 更新定时任务
  async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    // 取消旧调度
    await this.unscheduleTask(id);

    // 更新任务
    const updatedTask = await this.taskStore.update(id, updates);
    if (updatedTask && updatedTask.enabled) {
      await this.scheduleTask(updatedTask);
    }
    return updatedTask;
  }

  // 删除定时任务
  async deleteTask(id: string): Promise<boolean> {
    await this.unscheduleTask(id);
    return await this.taskStore.delete(id);
  }

  // 获取所有定时任务
  async getAllTasks(): Promise<ScheduledTask[]> {
    return await this.taskStore.getAll();
  }

  // 获取单个定时任务
  async getTask(id: string): Promise<ScheduledTask | null> {
    return await this.taskStore.get(id);
  }

  // 手动触发任务执行
  async triggerTask(id: string): Promise<void> {
    const task = await this.taskStore.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    await this.enqueueTask(task);
  }

  // 内部方法：调度单个任务
  private async scheduleTask(task: ScheduledTask): Promise<void> {
    if (!task.enabled) return;

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

  // 调度 Cron 任务
  private scheduleCronTask(task: ScheduledTask): void {
    if (!task.schedule.cron) return;

    const job = cron.schedule(
      task.schedule.cron,
      async () => {
        await this.enqueueTask(task);
      },
      {
        scheduled: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    );

    this.cronJobs.set(task.id, job);
  }

  // 调度间隔任务
  private scheduleIntervalTask(task: ScheduledTask): void {
    if (!task.schedule.intervalMs) return;

    const timer = setInterval(async () => {
      await this.enqueueTask(task);
    }, task.schedule.intervalMs);

    this.intervalTimers.set(task.id, timer);
  }

  // 调度一次性任务
  private scheduleOneTimeTask(task: ScheduledTask): void {
    if (!task.schedule.startTime) return;

    const delay = task.schedule.startTime - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(async () => {
      await this.enqueueTask(task);
    }, delay);

    this.intervalTimers.set(task.id, timer);
  }

  // 取消任务调度
  private async unscheduleTask(id: string): Promise<void> {
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

  // 将任务加入队列
  private async enqueueTask(task: ScheduledTask): Promise<void> {
    const queuedTask: QueuedTask = {
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

  // 计算下次执行时间
  private calculateNextRun(task: ScheduledTask): number | undefined {
    const now = Date.now();

    switch (task.schedule.type) {
      case 'cron':
        // node-cron 不提供下次执行时间计算，简单返回 now + 1分钟
        return now + 60000;
      case 'interval':
        return now + (task.schedule.intervalMs || 0);
      case 'one-time':
        return task.schedule.startTime;
    }
  }

  // 计算优先级 (数字越小优先级越高)
  private calculatePriority(task: ScheduledTask): number {
    // 根据 lastStatus 调整优先级
    if (task.lastStatus === 'failed') {
      return 1; // 失败任务优先重试
    }
    return 2;
  }
}
```

### 3.3 TaskQueue 模块

```typescript
// src/scheduler/taskQueue.ts

import { EventEmitter } from 'events';
import { QueuedTask } from './types';

export interface TaskQueueConfig {
  maxConcurrent: number; // 最大并发任务数
  maxQueueSize: number; // 最大队列长度
}

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxConcurrent: 3,
  maxQueueSize: 100,
};

export class TaskQueue extends EventEmitter {
  private config: TaskQueueConfig;
  private queue: QueuedTask[] = [];
  private runningCount = 0;
  private isProcessing = false;
  private executor?: (task: QueuedTask) => Promise<void>;

  constructor(config?: Partial<TaskQueueConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // 设置任务执行器
  setExecutor(executor: (task: QueuedTask) => Promise<void>): void {
    this.executor = executor;
  }

  // 启动队列处理
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processQueue();
  }

  // 停止队列处理
  stop(): void {
    this.isProcessing = false;
  }

  // 入队
  async enqueue(task: QueuedTask): Promise<void> {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('[TaskQueue] Queue full, rejecting task:', task.id);
      throw new Error('Task queue is full');
    }

    // 按优先级插入
    const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    console.log('[TaskQueue] Enqueued task:', task.scheduledTaskId, 'Priority:', task.priority);
  }

  // 出队
  dequeue(): QueuedTask | undefined {
    return this.queue.shift();
  }

  // 获取队列长度
  size(): number {
    return this.queue.length;
  }

  // 获取运行中的任务数
  getRunningCount(): number {
    return this.runningCount;
  }

  // 队列处理循环
  private async processQueue(): Promise<void> {
    if (!this.isProcessing) return;

    // 检查是否可以启动新任务
    while (
      this.isProcessing &&
      this.runningCount < this.config.maxConcurrent &&
      this.queue.length > 0 &&
      this.executor
    ) {
      const task = this.peekNextExecutable();
      if (!task) break;

      this.runningCount++;
      const dequeuedTask = this.dequeue();

      if (dequeuedTask) {
        this.executeTask(dequeuedTask).finally(() => {
          this.runningCount--;
          this.processQueue();
        });
      }
    }

    // 等待后继续处理
    if (this.isProcessing) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // 获取下一个可执行的任务
  private peekNextExecutable(): QueuedTask | undefined {
    const now = Date.now();
    return this.queue.find((task) => task.executeAt <= now);
  }

  // 执行任务
  private async executeTask(task: QueuedTask): Promise<void> {
    console.log('[TaskQueue] Executing task:', task.scheduledTaskId, 'Retry:', task.retryCount);

    try {
      if (this.executor) {
        await this.executor(task);
      }
      this.emit('task:completed', task);
    } catch (error) {
      console.error('[TaskQueue] Task failed:', task.scheduledTaskId, error);
      this.emit('task:failed', task, error);
    }
  }
}
```

### 3.4 TaskStore 模块

```typescript
// src/scheduler/taskStore.ts

import * as fs from 'fs';
import * as path from 'path';
import { ScheduledTask } from './types';

export class TaskStore {
  private dbPath: string;
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor(dbPath: string = './data/scheduled_tasks.json') {
    this.dbPath = dbPath;
    this.load();
  }

  // 从磁盘加载
  private load(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        const tasks: ScheduledTask[] = JSON.parse(data);
        for (const task of tasks) {
          this.tasks.set(task.id, task);
        }
        console.log('[TaskStore] Loaded', this.tasks.size, 'scheduled tasks');
      }
    } catch (error) {
      console.error('[TaskStore] Failed to load:', error);
    }
  }

  // 保存到磁盘
  private async save(): Promise<void> {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.tasks.values()), null, 2);
      await fs.promises.writeFile(this.dbPath, data, 'utf-8');
    } catch (error) {
      console.error('[TaskStore] Failed to save:', error);
    }
  }

  // 创建任务
  async create(
    task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScheduledTask> {
    const now = Date.now();
    const newTask: ScheduledTask = {
      ...task,
      id: `st_${now}_${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
    };
    this.tasks.set(newTask.id, newTask);
    await this.save();
    return newTask;
  }

  // 获取任务
  async get(id: string): Promise<ScheduledTask | null> {
    return this.tasks.get(id) || null;
  }

  // 获取所有任务
  async getAll(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values());
  }

  // 获取所有启用的任务
  async getAllEnabled(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values()).filter((t) => t.enabled);
  }

  // 更新任务
  async update(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      id: task.id, // 保护 id 不被修改
      createdAt: task.createdAt, // 保护 createdAt 不被修改
      updatedAt: Date.now(),
    };
    this.tasks.set(id, updatedTask);
    await this.save();
    return updatedTask;
  }

  // 删除任务
  async delete(id: string): Promise<boolean> {
    const deleted = this.tasks.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  // 更新执行状态
  async updateExecutionStatus(
    id: string,
    status: 'success' | 'failed' | 'cancelled',
    error?: string
  ): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updates: Partial<ScheduledTask> = {
      lastRun: Date.now(),
      lastStatus: status,
      lastError: error,
      runCount: task.runCount + 1,
    };
    return await this.update(id, updates);
  }
}
```

### 3.5 TaskExecutor 模块

```typescript
// src/scheduler/taskExecutor.ts

import { QueuedTask, TaskExecutionResult } from './types';
import { TaskHistoryService } from '../history/historyService';

export enum ExecutorMode {
  STANDALONE = 'standalone', // 独立执行模式
  INTEGRATED = 'integrated', // 复用 MainAgent 模式
}

export interface ExecutorConfig {
  mode: ExecutorMode;
  timeout?: number; // 超时时间 (ms)
}

export class TaskExecutor {
  private historyService: TaskHistoryService;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig = { mode: ExecutorMode.STANDALONE }) {
    this.historyService = new TaskHistoryService();
    this.config = config;
  }

  // 执行定时任务
  async execute(task: QueuedTask): Promise<TaskExecutionResult> {
    const scheduledTask = task.scheduledTask;
    const startTime = Date.now();

    console.log('[TaskExecutor] Starting scheduled task:', scheduledTask.name);

    let historyRecordId: string | null = null;

    try {
      // 创建任务历史记录
      const historyRecord = await this.historyService.createTask(
        `[定时] ${scheduledTask.name}: ${scheduledTask.execution.taskDescription}`,
        {
          source: 'scheduler',
          scheduledTaskId: scheduledTask.id,
          scheduledTaskName: scheduledTask.name,
        }
      );
      historyRecordId = historyRecord.id;

      // 开始执行
      await this.historyService.startTaskById(historyRecord.id);

      // 根据模式执行任务
      if (this.config.mode === ExecutorMode.INTEGRATED) {
        await this.executeWithMainAgent(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      } else {
        await this.executeStandalone(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      }

      // 完成
      await this.historyService.completeTask(historyRecord.id, {
        success: true,
        output: 'Task completed successfully',
      });

      return {
        taskId: scheduledTask.id,
        status: 'success',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        retryCount: task.retryCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[TaskExecutor] Task failed:', scheduledTask.name, errorMessage);

      // 记录失败状态 (不自动重试，由用户手动触发)
      if (historyRecordId) {
        try {
          await this.historyService.completeTask(historyRecordId, {
            success: false,
            error: errorMessage,
          });
        } catch (e) {
          console.error('[TaskExecutor] Failed to update history:', e);
        }
      }

      return {
        taskId: scheduledTask.id,
        status: 'failed',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage,
        retryCount: task.retryCount,
      };
    }
  }

  // 复用 MainAgent 执行 (集成模式)
  private async executeWithMainAgent(description: string, timeout?: number): Promise<void> {
    // TODO: 集成 MainAgent 执行逻辑
    // const agent = getMainAgent();
    // await agent.execute(description, { timeout });
    console.log('[TaskExecutor] Execute with MainAgent:', description);
    await this.simulateExecution(timeout);
  }

  // 独立执行 (standalone 模式)
  private async executeStandalone(description: string, timeout?: number): Promise<void> {
    // TODO: 创建独立的 TaskPlanner 实例执行任务
    // const planner = new TaskPlanner();
    // await planner.execute(description, { timeout });
    console.log('[TaskExecutor] Execute standalone:', description);
    await this.simulateExecution(timeout);
  }

  // 模拟执行 (placeholder)
  private async simulateExecution(timeout?: number): Promise<void> {
    const waitTime = timeout || 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000)));
  }
}
```

}
}

````

### 3.6 CronParser 模块

```typescript
// src/scheduler/cronParser.ts

import cron from 'node-cron';

export interface CronField {
  min: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export class CronParser {
  // 验证 Cron 表达式是否有效
  static validate(cronExpression: string): boolean {
    return cron.validate(cronExpression);
  }

  // 解析 Cron 表达式
  static parse(cronExpression: string): CronField | null {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    return {
      min: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4],
    };
  }

  // 将自然语言转换为 Cron 表达式
  static fromNaturalLanguage(type: string, value: string): string | null {
    switch (type) {
      case 'daily':
        // 每天 9:00 -> 0 9 * * *
        const dailyMatch = value.match(/^(\d{1,2}):(\d{2})$/);
        if (dailyMatch) {
          return `0 ${dailyMatch[1]} * * *`;
        }
        break;

      case 'weekly':
        // 每周五 18:00 -> 0 18 * * 5
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const weeklyMatch = value.match(/^(\w+)\s+(\d{1,2}):(\d{2})$/);
        if (weeklyMatch) {
          const dayIndex = days.indexOf(weeklyMatch[1].toLowerCase());
          if (dayIndex !== -1) {
            return `0 ${weeklyMatch[2]} * * ${dayIndex}`;
          }
        }
        break;

      case 'monthly':
        // 每月 1 日 9:00 -> 0 9 1 * *
        const monthlyMatch = value.match(/^(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (monthlyMatch) {
          return `0 ${monthlyMatch[2]} ${monthlyMatch[1]} * *`;
        }
        break;

      case 'hourly':
        // 每小时 -> 0 * * * *
        if (value === 'on') {
          return '0 * * * *';
        }
        break;
    }
    return null;
  }

  // 获取常用 Cron 表达式
  static getPresets(): { label: string; expression: string; description: string }[] {
    return [
      { label: '每天 9:00', expression: '0 9 * * *', description: '每天上午 9:00 执行' },
      { label: '每天 18:00', expression: '0 18 * * *', description: '每天下午 6:00 执行' },
      { label: '每周一 9:00', expression: '0 9 * * 1', description: '每周一上午 9:00 执行' },
      { label: '每周五 18:00', expression: '0 18 * * 5', description: '每周五下午 6:00 执行' },
      { label: '每月 1 日 9:00', expression: '0 9 1 * *', description: '每月 1 日上午 9:00 执行' },
      { label: '每小时', expression: '0 * * * *', description: '每小时的整点执行' },
    ];
  }

  // 计算下次执行时间 (近似)
  static getNextRunTime(cronExpression: string, fromTime: number = Date.now()): number | null {
    if (!cron.validate(cronExpression)) return null;

    // node-cron 不直接提供下次执行时间计算
    // 这里简单返回 fromTime + 1分钟作为近似
    // 实际项目中可以使用 cron-parser 库进行精确计算
    return fromTime + 60000;
  }
}
````

---

## 4. 文件结构

```
src/
├── scheduler/
│   ├── scheduler.ts           # 调度器主类
│   ├── cronParser.ts         # Cron 表达式解析
│   ├── taskQueue.ts          # 任务队列
│   ├── taskStore.ts          # 定时任务持久化
│   ├── taskExecutor.ts       # 任务执行器
│   └── types.ts              # 类型定义
│
├── renderer/
│   ├── components/
│   │   └── SchedulerPanel.tsx  # 定时任务 UI 面板 (新增)
│   └── stores/
│       └── schedulerStore.ts   # 定时任务状态管理 (新增)
│
└── main/
    └── ipcHandlers.ts         # IPC 处理器 (添加定时任务相关)
```

### 4.1 SchedulerStore (Zustand)

```typescript
// src/renderer/stores/schedulerStore.ts

import { create } from 'zustand';
import { ScheduledTask } from '../../scheduler/types';

interface CreateTaskInput {
  name: string;
  description: string;
  schedule: ScheduledTask['schedule'];
  execution: ScheduledTask['execution'];
  enabled?: boolean;
}

interface SchedulerState {
  tasks: ScheduledTask[];
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;

  // Actions
  loadTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  triggerTask: (id: string) => Promise<void>;
  enableTask: (id: string) => Promise<void>;
  disableTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  selectedTaskId: null,

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await window.electron.invoke('scheduler:list');
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createTask: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:create', input);
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  updateTask: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:update', id, updates);
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:delete', id);
      set({ selectedTaskId: null });
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  triggerTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:trigger', id);
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  enableTask: async (id) => {
    await get().updateTask(id, { enabled: true });
  },

  disableTask: async (id) => {
    await get().updateTask(id, { enabled: false });
  },

  selectTask: (id) => {
    set({ selectedTaskId: id });
  },
}));
```

### 4.2 SchedulerPanel UI 组件

```typescript
// src/renderer/components/SchedulerPanel.tsx

interface SchedulerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// 定时任务面板主要功能:
// - 任务列表展示 (执行中/待执行/已完成)
// - 创建新任务表单
// - 编辑现有任务
// - 启用/禁用任务
// - 手动触发任务
// - 删除任务
// - Cron 表达式可视化配置
```

### 4.3 IPC 接口

```typescript
// 定时任务 IPC 接口

// 获取所有定时任务
ipcMain.handle('scheduler:list', async () => {
  return await scheduler.getAllTasks();
});

// 获取单个定时任务
ipcMain.handle('scheduler:get', async (event, id: string) => {
  return await scheduler.getTask(id);
});

// 创建定时任务
ipcMain.handle('scheduler:create', async (event, task) => {
  return await scheduler.addTask(task);
});

// 更新定时任务
ipcMain.handle('scheduler:update', async (event, id: string, updates) => {
  return await scheduler.updateTask(id, updates);
});

// 删除定时任务
ipcMain.handle('scheduler:delete', async (event, id: string) => {
  return await scheduler.deleteTask(id);
});

// 手动触发任务
ipcMain.handle('scheduler:trigger', async (event, id: string) => {
  return await scheduler.triggerTask(id);
});

// 启用/禁用任务
ipcMain.handle('scheduler:enable', async (event, id: string) => {
  return await scheduler.updateTask(id, { enabled: true });
});

ipcMain.handle('scheduler:disable', async (event, id: string) => {
  return await scheduler.updateTask(id, { enabled: false });
});
```

---

## 5. 实施计划

### 5.1 周计划

| 周次    | 里程碑   | 任务                             | 交付物                     |
| ------- | -------- | -------------------------------- | -------------------------- |
| Week 25 | 核心调度 | CronParser, TaskStore, Scheduler | 定时触发、持久化           |
| Week 26 |          | 定时触发机制                     | 任务可到期自动执行         |
| Week 27 | 队列系统 | TaskQueue, TaskExecutor          | 失败状态记录、并发控制     |
| Week 28 |          | 执行模式集成                     | standalone/integrated 模式 |
| Week 29 | UI 集成  | 定时任务面板                     | 创建/编辑/删除/启用/禁用   |
| Week 30 | 完成     | Cron 配置 UI, TaskHistory 集成   | 完整定时任务功能           |

### 5.2 优先级

| 优先级 | 任务              | 说明                 |
| ------ | ----------------- | -------------------- |
| P0     | Scheduler 核心    | 定时任务调度基本功能 |
| P0     | TaskStore 持久化  | 任务配置保存和加载   |
| P1     | TaskQueue         | 队列、重试、并发控制 |
| P1     | IPC 接口          | 前后端通信           |
| P2     | SchedulerPanel UI | 可视化任务管理       |
| P2     | CronParser 增强   | 常用表达式预设       |

---

## 6. 成功指标

| 指标               | 目标  | 说明                         |
| ------------------ | ----- | ---------------------------- |
| 定时任务创建成功率 | > 99% | 创建的任务能正确调度         |
| Cron 表达式验证    | > 95% | 用户输入的表达式有效         |
| 任务执行准确率     | > 98% | 任务在预期时间 ±1 分钟内执行 |
| 并发控制有效性     | 100%  | 同时执行任务不超过限制       |
| 失败状态记录       | 100%  | 失败任务正确记录状态         |
| 任务历史集成       | 100%  | 所有执行记录写入 TaskHistory |
| 一次性任务自动禁用 | 100%  | 一次性任务执行后自动禁用     |

---

_文档创建日期: 2026-03-30_
