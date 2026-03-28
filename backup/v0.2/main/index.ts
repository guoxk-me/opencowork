import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import { setupIPC } from './ipc';
import { createMainWindow, createPreviewWindow } from './window';
import { setupShortcuts } from './shortcuts';
import { setTaskEnginePreviewWindow, setTaskEngineMainWindow } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;

async function bootstrap() {
  // 创建主窗口
  mainWindow = createMainWindow();

  // 设置主窗口引用到 TaskEngine
  setTaskEngineMainWindow(mainWindow);

  // 创建预览窗口
  previewWindow = createPreviewWindow();

  // 设置预览窗口引用到 TaskEngine
  setTaskEnginePreviewWindow(previewWindow);

  // 设置IPC处理器
  setupIPC(mainWindow, previewWindow);

  // 设置全局快捷键
  setupShortcuts(mainWindow);

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (previewWindow) {
      previewWindow.close();
    }
  });

  previewWindow?.on('closed', () => {
    previewWindow = null;
  });

  console.log('[OpenCowork] Application started successfully');
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap();
  }
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('[OpenCowork] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[OpenCowork] Unhandled rejection:', reason);
});
