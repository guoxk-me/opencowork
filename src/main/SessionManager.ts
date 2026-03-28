import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

function generateId(): string {
  return crypto.randomUUID();
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface TaskHistory {
  id: string;
  description: string;
  status: 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  logs: Array<{
    type: 'info' | 'success' | 'error' | 'step';
    message: string;
    timestamp: number;
  }>;
}

export interface SessionData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  tasks: TaskHistory[];
}

export interface SessionMeta {
  sessions: Array<{
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    taskCount: number;
  }>;
  activeSessionId: string | null;
}

class SessionManager {
  private sessionsDir: string;
  private metaPath: string;
  private meta: SessionMeta;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.sessionsDir = path.join(userDataPath, 'sessions');
    this.metaPath = path.join(this.sessionsDir, 'meta.json');
    this.meta = this.loadMeta();
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private loadMeta(): SessionMeta {
    this.ensureSessionsDir();
    try {
      if (fs.existsSync(this.metaPath)) {
        const data = fs.readFileSync(this.metaPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('[SessionManager] Failed to load meta:', err);
    }
    return { sessions: [], activeSessionId: null };
  }

  private saveMeta(): void {
    fs.writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), 'utf-8');
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId, 'session.json');
  }

  create(name?: string): SessionData {
    const session: SessionData = {
      id: generateId(),
      name: name || `会话 ${new Date().toLocaleString('zh-CN')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      tasks: [],
    };

    const sessionDir = path.join(this.sessionsDir, session.id);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(this.getSessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');

    this.meta.sessions.push({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: 0,
      taskCount: 0,
    });
    this.meta.activeSessionId = session.id;
    this.saveMeta();

    console.log('[SessionManager] Created session:', session.id);
    return session;
  }

  get(sessionId: string): SessionData | null {
    const sessionPath = this.getSessionPath(sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        const data = fs.readFileSync(sessionPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('[SessionManager] Failed to load session:', err);
    }
    return null;
  }

  update(sessionId: string, data: Partial<SessionData>): SessionData | null {
    const session = this.get(sessionId);
    if (!session) return null;

    const updated = { ...session, ...data, updatedAt: Date.now() };
    fs.writeFileSync(this.getSessionPath(sessionId), JSON.stringify(updated, null, 2), 'utf-8');

    const metaIndex = this.meta.sessions.findIndex(s => s.id === sessionId);
    if (metaIndex !== -1) {
      this.meta.sessions[metaIndex] = {
        ...this.meta.sessions[metaIndex],
        name: updated.name,
        updatedAt: updated.updatedAt,
        messageCount: updated.messages.length,
        taskCount: updated.tasks.length,
      };
      this.saveMeta();
    }

    return updated;
  }

  delete(sessionId: string): boolean {
    const sessionPath = path.join(this.sessionsDir, sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
      }
      this.meta.sessions = this.meta.sessions.filter(s => s.id !== sessionId);
      if (this.meta.activeSessionId === sessionId) {
        this.meta.activeSessionId = this.meta.sessions[0]?.id || null;
      }
      this.saveMeta();
      return true;
    } catch (err) {
      console.error('[SessionManager] Failed to delete session:', err);
      return false;
    }
  }

  list(): SessionMeta {
    return this.meta;
  }

  setActive(sessionId: string): void {
    if (this.meta.sessions.find(s => s.id === sessionId)) {
      this.meta.activeSessionId = sessionId;
      this.saveMeta();
    }
  }

  getActive(): SessionData | null {
    if (this.meta.activeSessionId) {
      return this.get(this.meta.activeSessionId);
    }
    return null;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;