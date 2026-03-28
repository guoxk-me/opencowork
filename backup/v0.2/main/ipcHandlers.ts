import { BrowserWindow } from 'electron';
import { TaskEngine } from '../core/runtime/TaskEngine';
import { PreviewManager } from '../preview/PreviewManager';

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

type IpcHandler = (
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null,
  payload: any
) => Promise<any>;

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // 任务相关
  'task:start': async (mainWindow, previewWindow, { task }) => {
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
    previewManager.setMode(mode);
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
};
