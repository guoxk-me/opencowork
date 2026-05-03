import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_RUNTIME_CONFIG, RuntimeConfig } from '../../shared/protocol';

export interface RuntimeConfigServiceOptions {
  configPath?: string;
}

export interface RuntimeConfigSaveResult {
  success: boolean;
  config: RuntimeConfig;
  warnings: string[];
  errors: string[];
}

type PartialRuntimeConfig = Omit<Partial<RuntimeConfig>, 'fileWatcher'> & {
  fileWatcher?: Partial<RuntimeConfig['fileWatcher']>;
};

export class RuntimeConfigService {
  private readonly configPath: string;
  private config: RuntimeConfig | null = null;
  private saveLock: Promise<RuntimeConfigSaveResult> = Promise.resolve({
    success: true,
    config: DEFAULT_RUNTIME_CONFIG,
    warnings: [],
    errors: [],
  });
  private lastWarnings: string[] = [];

  constructor(options: RuntimeConfigServiceOptions = {}) {
    const configDir = process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config');
    this.configPath = options.configPath || path.join(configDir, 'runtime.json');
  }

  get(): RuntimeConfig {
    if (this.config) {
      return this.clone(this.config);
    }

    this.config = this.load();
    return this.clone(this.config);
  }

  getLastWarnings(): string[] {
    return [...this.lastWarnings];
  }

  async save(nextConfig: PartialRuntimeConfig): Promise<RuntimeConfigSaveResult> {
    const runSave = async (): Promise<RuntimeConfigSaveResult> => {
      const merged = this.mergeWithDefaults(nextConfig);
      const validation = this.validate(merged);
      if (validation.errors.length > 0) {
        return {
          success: false,
          config: this.get(),
          warnings: validation.warnings,
          errors: validation.errors,
        };
      }

      try {
        await fs.promises.mkdir(path.dirname(this.configPath), { recursive: true });
        const tempPath = `${this.configPath}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(merged, null, 2), 'utf-8');
        await fs.promises.rename(tempPath, this.configPath);
        this.config = merged;
        this.lastWarnings = validation.warnings;
        return { success: true, config: this.clone(merged), warnings: validation.warnings, errors: [] };
      } catch (error) {
        return {
          success: false,
          config: this.get(),
          warnings: validation.warnings,
          errors: [`Failed to save runtime config: ${String(error)}`],
        };
      }
    };

    this.saveLock = this.saveLock.then(runSave, runSave);
    return this.saveLock;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private load(): RuntimeConfig {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(content) as PartialRuntimeConfig;
      const merged = this.mergeWithDefaults(parsed);
      const validation = this.validate(merged);
      if (validation.errors.length > 0) {
        this.lastWarnings = [
          ...validation.warnings,
          `Invalid runtime config, using defaults: ${validation.errors.join('; ')}`,
        ];
        // eslint-disable-next-line no-console
        console.warn('[RuntimeConfigService] Invalid config, falling back to defaults:', validation.errors);
        return this.clone(DEFAULT_RUNTIME_CONFIG);
      }
      this.lastWarnings = validation.warnings;
      return merged;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.lastWarnings = [`Failed to load runtime config, using defaults: ${String(error)}`];
        // eslint-disable-next-line no-console
        console.warn('[RuntimeConfigService] Failed to load config, falling back to defaults:', error);
      } else {
        this.lastWarnings = [];
      }
      return this.clone(DEFAULT_RUNTIME_CONFIG);
    }
  }

  private mergeWithDefaults(config: PartialRuntimeConfig): RuntimeConfig {
    return {
      ...DEFAULT_RUNTIME_CONFIG,
      ...config,
      version: DEFAULT_RUNTIME_CONFIG.version,
      approvalPolicies: Array.isArray(config.approvalPolicies)
        ? config.approvalPolicies
        : DEFAULT_RUNTIME_CONFIG.approvalPolicies,
      fileWatcher: {
        ...DEFAULT_RUNTIME_CONFIG.fileWatcher,
        ...(config.fileWatcher || {}),
      },
      mcp: {
        ...(DEFAULT_RUNTIME_CONFIG.mcp || {}),
        ...(config.mcp || {}),
      },
    };
  }

  private validate(config: RuntimeConfig): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (config.defaultMode !== 'plan' && config.defaultMode !== 'execute') {
      errors.push('defaultMode must be plan or execute');
    }

    if (!Number.isFinite(config.traceRetentionDays) || config.traceRetentionDays < 1) {
      warnings.push('traceRetentionDays must be positive; using default');
      config.traceRetentionDays = DEFAULT_RUNTIME_CONFIG.traceRetentionDays;
    }

    if (!Number.isFinite(config.artifactRetentionDays) || config.artifactRetentionDays < 1) {
      warnings.push('artifactRetentionDays must be positive; using default');
      config.artifactRetentionDays = DEFAULT_RUNTIME_CONFIG.artifactRetentionDays;
    }

    if (!Number.isFinite(config.maxInlineOutputBytes) || config.maxInlineOutputBytes < 1024) {
      warnings.push('maxInlineOutputBytes too small; using default');
      config.maxInlineOutputBytes = DEFAULT_RUNTIME_CONFIG.maxInlineOutputBytes;
    }

    if (!Number.isFinite(config.fileWatcher.maxFileBytes) || config.fileWatcher.maxFileBytes < 1024) {
      warnings.push('fileWatcher.maxFileBytes too small; using default');
      config.fileWatcher.maxFileBytes = DEFAULT_RUNTIME_CONFIG.fileWatcher.maxFileBytes;
    }

    if (!Number.isFinite(config.fileWatcher.maxFiles) || config.fileWatcher.maxFiles < 1) {
      warnings.push('fileWatcher.maxFiles must be positive; using default');
      config.fileWatcher.maxFiles = DEFAULT_RUNTIME_CONFIG.fileWatcher.maxFiles;
    }

    return { warnings, errors };
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

let runtimeConfigService: RuntimeConfigService | null = null;

export function getRuntimeConfigService(): RuntimeConfigService {
  if (!runtimeConfigService) {
    runtimeConfigService = new RuntimeConfigService();
  }
  return runtimeConfigService;
}

export function resetRuntimeConfigService(): void {
  runtimeConfigService = null;
}
