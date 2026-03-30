import * as fs from 'fs';
import * as path from 'path';
import {
  WhitelistConfig,
  DEFAULT_WHITELIST_CONFIG,
  validateWhitelistConfig,
  WhitelistValidationResult,
} from './whitelistConfig';

export class WhitelistConfigStore {
  private configPath: string;
  private config: WhitelistConfig | null = null;
  private loadWarningIssued = false;

  constructor(configPath: string = './config/whitelist.json') {
    this.configPath = configPath;
  }

  async load(): Promise<WhitelistConfig> {
    try {
      const absolutePath = path.resolve(this.configPath);
      if (fs.existsSync(absolutePath)) {
        const content = await fs.promises.readFile(absolutePath, 'utf-8');
        const parsed = JSON.parse(content) as WhitelistConfig;
        this.config = this.mergeWithDefaults(parsed);
        return this.config;
      }
    } catch (error) {
      console.error('[WhitelistConfigStore] Failed to load config:', error);
      if (!this.loadWarningIssued) {
        console.warn(
          '[WhitelistConfigStore] Falling back to default config. Your config file may be corrupted.'
        );
        this.loadWarningIssued = true;
      }
    }
    this.config = { ...DEFAULT_WHITELIST_CONFIG };
    return this.config;
  }

  async save(
    config: WhitelistConfig
  ): Promise<{ success: boolean; validation: WhitelistValidationResult }> {
    const validation = validateWhitelistConfig(config);
    if (!validation.valid) {
      return { success: false, validation };
    }

    try {
      const absolutePath = path.resolve(this.configPath);
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      const tempPath = absolutePath + '.tmp';
      await fs.promises.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8');
      await fs.promises.rename(tempPath, absolutePath);

      this.config = config;
      return { success: true, validation };
    } catch (error) {
      console.error('[WhitelistConfigStore] Failed to save config:', error);
      return {
        success: false,
        validation: { valid: false, errors: [`Failed to save: ${error}`], warnings: [] },
      };
    }
  }

  async get(): Promise<WhitelistConfig> {
    if (this.config) {
      return this.config;
    }
    return this.load();
  }

  async reset(): Promise<WhitelistConfig> {
    this.config = { ...DEFAULT_WHITELIST_CONFIG };
    await this.save(this.config);
    return this.config;
  }

  async exportConfig(): Promise<string> {
    const config = await this.get();
    return JSON.stringify(config, null, 2);
  }

  async importConfig(
    configJson: string
  ): Promise<{ success: boolean; validation: WhitelistValidationResult }> {
    try {
      const config = JSON.parse(configJson) as WhitelistConfig;
      return this.save(config);
    } catch (error) {
      return {
        success: false,
        validation: { valid: false, errors: [`Invalid JSON: ${error}`], warnings: [] },
      };
    }
  }

  private mergeWithDefaults(config: Partial<WhitelistConfig>): WhitelistConfig {
    const defaultConfig = { ...DEFAULT_WHITELIST_CONFIG };

    return {
      cli: {
        enabled: config.cli?.enabled ?? defaultConfig.cli.enabled,
        commands: this.mergeArrayElements(
          defaultConfig.cli.commands,
          config.cli?.commands,
          'command'
        ),
      },
      paths: {
        enabled: config.paths?.enabled ?? defaultConfig.paths.enabled,
        entries: this.mergeArrayElements(
          defaultConfig.paths.entries,
          config.paths?.entries,
          'path'
        ),
      },
      network: {
        enabled: config.network?.enabled ?? defaultConfig.network.enabled,
        hosts: this.mergeArrayElements(defaultConfig.network.hosts, config.network?.hosts, 'host'),
        blockedPorts: config.network?.blockedPorts ?? defaultConfig.network.blockedPorts,
      },
      agents: {
        enabled: config.agents?.enabled ?? defaultConfig.agents.enabled,
        tools: this.mergeArrayElements(
          defaultConfig.agents.tools,
          config.agents?.tools,
          'toolName'
        ),
        maxStepsPerTask: config.agents?.maxStepsPerTask ?? defaultConfig.agents.maxStepsPerTask,
      },
    };
  }

  private mergeArrayElements<
    T extends { command?: string; path?: string; host?: string; toolName?: string },
  >(defaultArray: T[], customArray: T[] | undefined, keyField: keyof T): T[] {
    if (!customArray || customArray.length === 0) {
      return this.deepCloneArray(defaultArray);
    }

    const result: T[] = this.deepCloneArray(defaultArray);

    for (const item of customArray) {
      const key = item[keyField];
      const existingIndex = result.findIndex((r) => r[keyField] === key);
      if (existingIndex >= 0) {
        result[existingIndex] = this.deepMerge(result[existingIndex], item);
      } else {
        result.push(this.deepClone(item));
      }
    }

    return result;
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (cloned as Record<string, unknown>)[key] = this.deepClone(
          (obj as Record<string, unknown>)[key]
        );
      }
    }
    return cloned;
  }

  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        result[key] = this.deepClone(sourceValue);
      }
    }
    return result as T;
  }

  private deepCloneArray<T>(arr: T[]): T[] {
    return arr.map((item) => this.deepClone(item));
  }

  getConfigPath(): string {
    return this.configPath;
  }
}

let whitelistConfigStoreInstance: WhitelistConfigStore | null = null;
let lastConfigPath: string | null = null;

export function getWhitelistConfigStore(configPath?: string): WhitelistConfigStore {
  if (configPath && configPath !== lastConfigPath) {
    whitelistConfigStoreInstance = new WhitelistConfigStore(configPath);
    lastConfigPath = configPath;
  }

  if (!whitelistConfigStoreInstance) {
    whitelistConfigStoreInstance = new WhitelistConfigStore(configPath);
    lastConfigPath = configPath || './config/whitelist.json';
  }

  return whitelistConfigStoreInstance;
}

export function createWhitelistConfigStore(configPath?: string): WhitelistConfigStore {
  whitelistConfigStoreInstance = new WhitelistConfigStore(configPath);
  lastConfigPath = configPath || './config/whitelist.json';
  return whitelistConfigStoreInstance;
}
