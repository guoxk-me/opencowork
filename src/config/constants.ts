// 任务引擎配置
export const TASK_ENGINE_CONFIG = {
  taskTimeout: 30 * 60 * 1000, // 30分钟

  actionTimeout: {
    'browser:navigate': 30000,
    'browser:click': 10000,
    'browser:input': 10000,
    'browser:wait': 60000,
    'browser:extract': 15000,
    'browser:screenshot': 20000,
    'cli:execute': 60000,
    'ask:user': 300000,
  } as Record<string, number>,

  retry: {
    maxRetries: 3,
    backoff: 'exponential' as const,
    initialDelay: 1000,
    maxDelay: 30000,
  },

  takeover: {
    escResponseTime: 50,
    buttonResponseTime: 100,
  },
};

// 预览窗口配置
export const PREVIEW_CONFIG = {
  detached: {
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenCowork - Browser Preview',
  },

  sync: {
    useCDP: true,
    frameRate: 30,
  },
};

// LLM配置
export const LLM_DEFAULT_CONFIG = {
  provider: 'openai',
  model: 'gpt-4-turbo',
  timeout: 60000,
  maxRetries: 3,
  temperature: 0.7,
};

// IPC通道
export const IPC_CHANNELS = {
  // 任务相关
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_CANCEL: 'task:cancel',
  TASK_TAKEOVER: 'task:takeover',
  TASK_RESUME_FROM_USER: 'task:resumeFromUser',
  TASK_GET_STATE: 'task:getState',

  // 预览相关
  PREVIEW_SET_MODE: 'preview:setMode',
  PREVIEW_GET_STATE: 'preview:getState',

  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // 窗口相关
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const;

// 渲染进程IPC通道
export const RENDERER_CHANNELS = {
  TASK_STATUS_UPDATE: 'task:statusUpdate',
  TASK_PROGRESS_UPDATE: 'task:progressUpdate',
  TASK_NODE_START: 'task:nodeStart',
  TASK_NODE_COMPLETE: 'task:nodeComplete',
  TASK_ERROR: 'task:error',
  TASK_FAILED: 'task:failed',
  TASK_PLAN_UPDATE: 'task:planUpdate',
  TASK_TAKEOVER_REQUEST: 'task:takeoverRequest',
  TASK_COMPLETED: 'task:completed',
  ASK_USER_REQUEST: 'ask:user:request',
  ASK_USER_RESPONSE: 'ask:user:response',
} as const;
