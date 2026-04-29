export type DesktopHarnessStatus = 'idle' | 'launching' | 'running' | 'shutting-down' | 'stopped';

export interface DesktopHarnessCommandSpec {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface DesktopHarnessHooks {
  onLaunch?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
}

export interface DesktopHarnessSnapshot {
  status: DesktopHarnessStatus;
  launchCount: number;
  shutdownCount: number;
  startedAt?: number;
  stoppedAt?: number;
  hasLaunchHook: boolean;
  hasShutdownHook: boolean;
}

export function parseDesktopHarnessCommandSpec(
  raw: string | undefined,
  loggerPrefix: string
): DesktopHarnessCommandSpec | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const command = typeof record.command === 'string' ? record.command.trim() : '';
    if (!command) {
      return null;
    }

    const args = Array.isArray(record.args)
      ? record.args.filter((value): value is string => typeof value === 'string')
      : undefined;
    const cwd = typeof record.cwd === 'string' ? record.cwd : undefined;
    const env = record.env && typeof record.env === 'object' && !Array.isArray(record.env)
      ? Object.fromEntries(
          Object.entries(record.env).filter(([, value]) => typeof value === 'string') as Array<[string, string]>
        )
      : undefined;

    return {
      command,
      args,
      cwd,
      env,
    };
  } catch (error) {
    console.warn(`[${loggerPrefix}] Failed to parse command spec:`, error);
    return null;
  }
}

export function createDesktopHarnessCommandHooks(
  launchCommand: DesktopHarnessCommandSpec | null | undefined,
  shutdownCommand: DesktopHarnessCommandSpec | null | undefined,
  loggerPrefix: string
): DesktopHarnessHooks {
  const hooks: DesktopHarnessHooks = {};

  if (launchCommand) {
    hooks.onLaunch = async () => {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      console.log(`[${loggerPrefix}] launching desktop harness via command:`, launchCommand.command);
      await execFileAsync(launchCommand.command, launchCommand.args || [], {
        cwd: launchCommand.cwd,
        env: {
          ...process.env,
          ...(launchCommand.env || {}),
        },
      });
    };
  }

  if (shutdownCommand) {
    hooks.onShutdown = async () => {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      console.log(`[${loggerPrefix}] shutting down desktop harness via command:`, shutdownCommand.command);
      await execFileAsync(shutdownCommand.command, shutdownCommand.args || [], {
        cwd: shutdownCommand.cwd,
        env: {
          ...process.env,
          ...(shutdownCommand.env || {}),
        },
      });
    };
  }

  return hooks;
}

export abstract class SerializedDesktopHarnessControllerBase {
  private status: DesktopHarnessStatus = 'idle';
  private launchCount = 0;
  private shutdownCount = 0;
  private startedAt?: number;
  private stoppedAt?: number;
  private transitionQueue: Promise<void> = Promise.resolve();

  protected constructor(protected readonly hooks: DesktopHarnessHooks = {}) {}

  protected async launchSerialized(loggerPrefix: string): Promise<void> {
    await this.enqueueTransition(async () => {
      if (this.status === 'running') {
        return;
      }

      this.status = 'launching';
      this.launchCount += 1;
      this.startedAt = Date.now();
      this.stoppedAt = undefined;

      try {
        await this.hooks.onLaunch?.();
        this.status = 'running';
      } catch (error) {
        console.error(`[${loggerPrefix}] launch failed`, error);
        this.status = 'idle';
        this.startedAt = undefined;
        throw error;
      }
    });
  }

  protected async shutdownSerialized(loggerPrefix: string): Promise<void> {
    await this.enqueueTransition(async () => {
      if (this.status === 'idle' || this.status === 'stopped') {
        return;
      }

      this.status = 'shutting-down';
      this.shutdownCount += 1;

      try {
        await this.hooks.onShutdown?.();
        this.status = 'stopped';
        this.stoppedAt = Date.now();
      } catch (error) {
        console.error(`[${loggerPrefix}] shutdown failed`, error);
        this.status = 'running';
        throw error;
      }
    });
  }

  protected createSnapshotBase(): DesktopHarnessSnapshot {
    return {
      status: this.status,
      launchCount: this.launchCount,
      shutdownCount: this.shutdownCount,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      hasLaunchHook: typeof this.hooks.onLaunch === 'function',
      hasShutdownHook: typeof this.hooks.onShutdown === 'function',
    };
  }

  private enqueueTransition<T>(transition: () => Promise<T>): Promise<T> {
    const next = this.transitionQueue.then(transition, transition);
    this.transitionQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}
