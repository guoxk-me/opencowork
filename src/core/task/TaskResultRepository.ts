import * as fs from 'fs';
import * as path from 'path';
import { TaskResult } from './types';

export class TaskResultRepository {
  private filePath: string;

  constructor(filePath?: string) {
    const configDir = process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config');
    this.filePath = filePath || path.join(configDir, 'task-results.json');
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadAllSync(): TaskResult[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TaskResult[]) : [];
    } catch (error) {
      console.error('[TaskResultRepository] Failed to load results:', error);
      return [];
    }
  }

  private saveAllSync(results: TaskResult[]): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath, JSON.stringify(results, null, 2), 'utf-8');
  }

  list(): TaskResult[] {
    return this.loadAllSync();
  }

  getById(id: string): TaskResult | null {
    return this.loadAllSync().find((r) => r.id === id) || null;
  }

  save(result: TaskResult): void {
    const results = this.loadAllSync();
    const index = results.findIndex((r) => r.id === result.id);
    if (index >= 0) {
      results[index] = result;
    } else {
      results.push(result);
    }
    this.saveAllSync(results);
  }

  listRecent(limit: number = 50): TaskResult[] {
    const results = this.loadAllSync();
    return results
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }
}

let taskResultRepository: TaskResultRepository | null = null;

export function getTaskResultRepository(): TaskResultRepository {
  if (!taskResultRepository) {
    taskResultRepository = new TaskResultRepository();
  }
  return taskResultRepository;
}
