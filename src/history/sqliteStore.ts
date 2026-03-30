import betterSqlite3 from 'better-sqlite3';
import { TaskHistoryRecord } from './taskHistory';

function safeJsonParse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('[SQLiteStore] Failed to parse JSON:', error);
    return null;
  }
}

export class SQLiteStore {
  private db: ReturnType<typeof betterSqlite3>;
  private dbPath: string;

  constructor(dbPath: string = './history.db') {
    this.dbPath = dbPath;
    this.db = betterSqlite3(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_namespace ON task_history(namespace);
      CREATE INDEX IF NOT EXISTS idx_created_at ON task_history(created_at);
    `);
  }

  async put(namespace: string[], key: string, value: TaskHistoryRecord): Promise<void> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_history (id, namespace, key, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    const id = `${ns}:${key}`;
    stmt.run(id, ns, key, JSON.stringify(value), now, now);
  }

  async get(namespace: string[], key: string): Promise<TaskHistoryRecord | null> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ? AND key = ?
    `);
    const row = stmt.get(ns, key) as { data: string } | undefined;
    if (row) {
      return safeJsonParse<TaskHistoryRecord>(row.data);
    }
    return null;
  }

  async delete(namespace: string[], key: string): Promise<void> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      DELETE FROM task_history WHERE namespace = ? AND key = ?
    `);
    stmt.run(ns, key);
  }

  async query(
    namespace: string[],
    options: {
      filter?: (record: TaskHistoryRecord) => boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TaskHistoryRecord[]> {
    const ns = namespace.join(':');
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const maxFetchLimit = 1000;

    if (options.filter) {
      const tempRecords = this.db
        .prepare(
          `SELECT data FROM task_history WHERE namespace = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(ns, maxFetchLimit) as { data: string }[];
      const parsedRecords = tempRecords
        .map((row) => safeJsonParse<TaskHistoryRecord>(row.data))
        .filter((r): r is TaskHistoryRecord => r !== null);
      const filtered = parsedRecords.filter(options.filter);
      if (tempRecords.length >= maxFetchLimit) {
        console.warn(
          `[SQLiteStore] Filter query hit limit of ${maxFetchLimit}, results may be incomplete`
        );
      }
      return filtered.slice(offset, offset + limit);
    }

    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(ns, limit, offset) as { data: string }[];
    return rows
      .map((row) => safeJsonParse<TaskHistoryRecord>(row.data))
      .filter((r): r is TaskHistoryRecord => r !== null);
  }

  async list(namespace: string[]): Promise<TaskHistoryRecord[]> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(ns) as { data: string }[];
    return rows
      .map((row) => safeJsonParse<TaskHistoryRecord>(row.data))
      .filter((r): r is TaskHistoryRecord => r !== null);
  }

  async close(): Promise<void> {
    try {
      this.db.close();
    } catch (error) {
      console.error('[SQLiteStore] Failed to close database:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM task_history');
    } catch (error) {
      console.error('[SQLiteStore] Failed to clear database:', error);
    }
  }

  async size(): Promise<number> {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM task_history').get() as {
        count: number;
      };
      return result?.count || 0;
    } catch (error) {
      console.error('[SQLiteStore] Failed to get size:', error);
      return 0;
    }
  }
}
