import { BrowserWindow } from 'electron';
import { TaskEngine } from '../core/runtime/TaskEngine';
import { PreviewManager } from '../preview/PreviewManager';
import { sessionManager } from './SessionManager';

const taskEngine = new TaskEngine();
const previewManager = new PreviewManager();

// Set main window reference
export function setTaskEngineMainWindow(window: BrowserWindow | null): void {
  taskEngine.setMainWindow(window);
}

// Set preview window reference
export function setTaskEnginePreviewWindow(window: BrowserWindow | null): void {
  taskEngine.setPreviewWindow(window);
}

// Export taskEngine for direct access if needed
export function getTaskEngine(): TaskEngine {
  return taskEngine;
}

// Export previewManager for direct access if needed
export function getPreviewManager(): PreviewManager {
  return previewManager;
}

type IpcHandler = (
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null,
  payload: any
) => Promise<any>;

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // 任务相关
  'task:start': async (mainWindow, previewWindow, { task }) => {
    // 检查是否有任务正在执行
    if (taskEngine.isTaskRunning()) {
      return { success: false, error: '已有任务正在执行中，请等待完成后再发起新任务' };
    }
    const handle = await taskEngine.startTask(task, mainWindow ?? undefined);
    return { handle };
  },

  'task:pause': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.pause(handleId);
    return { success: true };
  },

  'task:resume': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.resume(handleId);
    return { success: true };
  },

  'task:cancel': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.cancel(handleId);
    return { success: true };
  },

  'task:takeover': async (mainWindow, previewWindow, { handleId }) => {
    const context = await taskEngine.takeover(handleId);
    return { context };
  },

  'task:resumeFromUser': async (mainWindow, previewWindow, { handleId, action }) => {
    await taskEngine.resumeFromUser(handleId, action);
    return { success: true };
  },

  'task:getState': async (mainWindow, previewWindow, { handleId }) => {
    const state = taskEngine.getState(handleId);
    return { state };
  },

  // 预览相关
  'preview:setMode': async (mainWindow, previewWindow, { mode }) => {
    // sidebar 模式由 Renderer 处理（通过截图显示），不需要 BrowserView
    // 只有 detached 模式需要创建独立窗口
    if (mode === 'detached' && mainWindow) {
      await previewManager.initialize(mainWindow);
      await previewManager.setMode('detached');
    }
    // sidebar 模式不做任何操作，让 Renderer 显示截图
    return { success: true };
  },

  'preview:getState': async (mainWindow, previewWindow) => {
    const state = previewManager.getState();
    return { state };
  },

  // 配置相关
  'config:get': async () => {
    // TODO: 从文件加载配置
    return {};
  },

  'config:set': async (mainWindow, previewWindow, { config }) => {
    // TODO: 保存配置到文件
    console.log('[Config] Saving config:', config);
    return { success: true };
  },

  // 窗口相关
  'window:minimize': async (mainWindow) => {
    mainWindow?.minimize();
    return { success: true };
  },

  'window:maximize': async (mainWindow) => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
    return { success: true };
  },

  'window:close': async (mainWindow) => {
    mainWindow?.close();
    return { success: true };
  },

  // 会话相关
  'session:create': async (mainWindow, previewWindow, { name }) => {
    const session = sessionManager.create(name);
    return { session };
  },

  'session:list': async (mainWindow, previewWindow) => {
    const meta = sessionManager.list();
    return { meta };
  },

  'session:get': async (mainWindow, previewWindow, { sessionId }) => {
    const session = sessionManager.get(sessionId);
    return { session };
  },

  'session:update': async (mainWindow, previewWindow, { sessionId, data }) => {
    const session = sessionManager.update(sessionId, data);
    return { session };
  },

  'session:delete': async (mainWindow, previewWindow, { sessionId }) => {
    const success = sessionManager.delete(sessionId);
    return { success };
  },

  'session:setActive': async (mainWindow, previewWindow, { sessionId }) => {
    sessionManager.setActive(sessionId);
    return { success: true };
  },

  'session:getActive': async (mainWindow, previewWindow) => {
    const session = sessionManager.getActive();
    return { session };
  },
};
