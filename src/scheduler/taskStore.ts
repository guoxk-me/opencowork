// src/scheduler/taskStore.ts

import * as fs from 'fs';
import * as path from 'path';
import { ScheduledTask, CreateScheduledTaskInput, UpdateScheduledTaskInput } from './types';

export class TaskStore {
  private dbPath: string;
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor(dbPath: string = './data/scheduled_tasks.json') {
    this.dbPath = dbPath;
    this.load();
  }

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

  async create(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const now = Date.now();
    const newTask: ScheduledTask = {
      ...input,
      id: `st_${now}_${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
    };
    this.tasks.set(newTask.id, newTask);
    await this.save();
    return newTask;
  }

  async get(id: string): Promise<ScheduledTask | null> {
    return this.tasks.get(id) || null;
  }

  async getAll(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values());
  }

  async getAllEnabled(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values()).filter((t) => t.enabled);
  }

  async update(id: string, updates: UpdateScheduledTaskInput): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: Date.now(),
    };
    this.tasks.set(id, updatedTask);
    await this.save();
    return updatedTask;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.tasks.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  async updateExecutionStatus(
    id: string,
    status: 'success' | 'failed' | 'cancelled',
    error?: string
  ): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    if (!task) return null;

    const updates: UpdateScheduledTaskInput = {
      lastRun: Date.now(),
      lastStatus: status,
      lastError: error,
      runCount: task.runCount + 1,
    };
    return await this.update(id, updates);
  }
}
