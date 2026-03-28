export const DEFAULT_CONFIG = {
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
export function loadConfig() {
    // TODO: 从文件加载配置
    return DEFAULT_CONFIG;
}
export function saveConfig(config) {
    // TODO: 保存配置到文件
    console.log('Saving config:', config);
}
