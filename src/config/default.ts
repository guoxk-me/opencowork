export interface AppConfig {
  llm: {
    provider: 'openai' | 'anthropic' | 'custom';
    model: string;
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    temperature: number;
  };
  preview: {
    defaultMode: 'sidebar' | 'collapsible' | 'detached';
    detachedWidth: number;
    detachedHeight: number;
  };
  security: {
    cliWhitelistEnabled: boolean;
    requireConfirmForSensitive: boolean;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-4-turbo',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    timeout: 60000,
    maxRetries: 3,
    temperature: 0.7,
  },
  preview: {
    defaultMode: 'sidebar',
    detachedWidth: 1024,
    detachedHeight: 768,
  },
  security: {
    cliWhitelistEnabled: true,
    requireConfirmForSensitive: true,
  },
};

export function loadConfig(): AppConfig {
  // TODO: 从文件加载配置
  return DEFAULT_CONFIG;
}

export function saveConfig(config: AppConfig): void {
  // TODO: 保存配置到文件
  console.log('Saving config:', config);
}
