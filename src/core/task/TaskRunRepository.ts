import * as fs from 'fs';
import * as path from 'path';
import { TaskRun } from './types';

export class TaskRunRepository {
  private filePath: string;

  constructor(filePath?: string) {
    const configDir = process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config');
    this.filePath = filePath || path.join(configDir, 'task-runs.json');
  }

  private loadAllSync(): TaskRun[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TaskRun[]) : [];
    } catch (error) {
      console.error('[TaskRunRepository] Failed to load task runs:', error);
      return [];
    }
  }

  private saveAllSync(runs: TaskRun[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(runs, null, 2), 'utf-8');
  }

  list(): TaskRun[] {
    return this.loadAllSync();
  }

  listRecent(limit: number = 50): TaskRun[] {
    return this.loadAllSync()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  getById(id: string): TaskRun | null {
    return this.loadAllSync().find((run) => run.id === id) || null;
  }

  upsert(run: TaskRun): void {
    const runs = this.loadAllSync();
    const index = runs.findIndex((item) => item.id === run.id);
    if (index === -1) {
      runs.push(run);
    } else {
      runs[index] = run;
    }
    this.saveAllSync(runs);
  }
}

let taskRunRepository: TaskRunRepository | null = null;

export function getTaskRunRepository(): TaskRunRepository {
  if (!taskRunRepository) {
    taskRunRepository = new TaskRunRepository();
  }
  return taskRunRepository;
}
